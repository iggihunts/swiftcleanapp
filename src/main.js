const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// ── Constants ─────────────────────────────────────────────────────────────────

const HOME = os.homedir();
const SWIFTCLEAN_DIR = path.join(HOME, '.swiftclean');
const CLAMAV_DB_DIR  = path.join(SWIFTCLEAN_DIR, 'clamav-db');
const QUARANTINE_DIR = path.join(SWIFTCLEAN_DIR, 'quarantine');
const isDev = process.argv.includes('--dev');

// Ensure app directories exist
[SWIFTCLEAN_DIR, CLAMAV_DB_DIR, QUARANTINE_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── ClamAV binary resolution ──────────────────────────────────────────────────

function getClamScanPath() {
  // Check bundled binary first (packed into Resources/bin/ by electron-builder)
  const resourcesBin = path.join(process.resourcesPath || '', 'bin');
  const bundled = path.join(resourcesBin, 'clamscan');
  if (fs.existsSync(bundled)) return bundled;
  // Homebrew fallbacks
  for (const p of ['/opt/homebrew/bin/clamscan', '/usr/local/bin/clamscan']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getFreshclamPath() {
  const resourcesBin = path.join(process.resourcesPath || '', 'bin');
  const bundled = path.join(resourcesBin, 'freshclam');
  if (fs.existsSync(bundled)) return bundled;
  for (const p of ['/opt/homebrew/bin/freshclam', '/usr/local/bin/freshclam']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bytesToHuman(bytes) {
  const GB = 1_073_741_824, MB = 1_048_576, KB = 1_024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
}

function runCmd(cmd, args = []) {
  return new Promise((resolve, reject) => {
    exec([cmd, ...args].join(' '), { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

function dirSize(dirPath) {
  return new Promise(resolve => {
    exec(`du -sk "${dirPath}" 2>/dev/null`, (err, stdout) => {
      if (err || !stdout) return resolve(0);
      const kb = parseInt(stdout.split('\t')[0], 10);
      resolve(isNaN(kb) ? 0 : kb * 1024);
    });
  });
}

// ── Window ────────────────────────────────────────────────────────────────────

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#0d0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  if (isDev) mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── IPC Handlers ──────────────────────────────────────────────────────────────

// Disk usage
ipcMain.handle('get_disk_usage', async () => {
  const out = await runCmd('df -k /');
  const parts = out.split('\n')[1].trim().split(/\s+/);
  const total = parseInt(parts[1]) * 1024;
  const used  = parseInt(parts[2]) * 1024;
  const free  = parseInt(parts[3]) * 1024;
  return { total_bytes: total, used_bytes: used, free_bytes: free, used_pct: (used / total * 100) };
});

// Scan junk
ipcMain.handle('scan_junk', async (event) => {
  const paths = [
    { name: 'User App Cache',      path: path.join(HOME, 'Library/Caches') },
    { name: 'System Logs',         path: path.join(HOME, 'Library/Logs') },
    { name: 'Trash',               path: path.join(HOME, '.Trash') },
    { name: 'Chrome Cache',        path: path.join(HOME, 'Library/Caches/Google/Chrome') },
    { name: 'Firefox Cache',       path: path.join(HOME, 'Library/Caches/Firefox') },
    { name: 'Safari Cache',        path: path.join(HOME, 'Library/Caches/com.apple.Safari') },
    { name: 'Xcode Derived Data',  path: path.join(HOME, 'Library/Developer/Xcode/DerivedData') },
    { name: 'Xcode Archives',      path: path.join(HOME, 'Library/Developer/Xcode/Archives') },
    { name: 'iOS Device Support',  path: path.join(HOME, 'Library/Developer/Xcode/iOS DeviceSupport') },
    { name: 'npm Cache',           path: path.join(HOME, 'Library/Caches/node') },
    { name: 'Spotify Cache',       path: path.join(HOME, 'Library/Caches/com.spotify.client') },
    { name: 'Slack Cache',         path: path.join(HOME, 'Library/Caches/com.tinyspeck.slackmacgap') },
  ];

  const items = [];
  for (const p of paths) {
    if (fs.existsSync(p.path)) {
      event.sender.send('scan_progress', { current: p.name, path: p.path });
      const size = await dirSize(p.path);
      if (size > 0) items.push({ name: p.name, path: p.path, size_bytes: size, size_human: bytesToHuman(size) });
    }
  }
  const total = items.reduce((a, i) => a + i.size_bytes, 0);
  return { items, total_bytes: total, total_human: bytesToHuman(total) };
});

// Clean junk
ipcMain.handle('clean_junk', async (event, { paths }) => {
  let freed = 0;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const size = await dirSize(p);
      await runCmd(`rm -rf "${p}"`).catch(() => {});
      freed += size;
    }
  }
  return bytesToHuman(freed);
});

// List apps
ipcMain.handle('list_apps', async () => {
  const appDirs = ['/Applications', path.join(HOME, 'Applications')];
  const apps = [];
  for (const dir of appDirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir).filter(e => e.endsWith('.app'));
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const name = entry.replace('.app', '');
      const size = await dirSize(fullPath);
      apps.push({ name, path: fullPath, size_bytes: size, size_human: bytesToHuman(size) });
    }
  }
  return apps.sort((a, b) => b.size_bytes - a.size_bytes);
});

// Uninstall app
ipcMain.handle('uninstall_app', async (event, { appPath }) => {
  const name = path.basename(appPath, '.app');
  const remnants = [
    path.join(HOME, `Library/Application Support/${name}`),
    path.join(HOME, `Library/Caches/${name}`),
    path.join(HOME, `Library/Preferences/com.${name.toLowerCase()}.plist`),
    path.join(HOME, `Library/Logs/${name}`),
    path.join(HOME, `Library/Saved Application State/com.${name.toLowerCase()}.savedState`),
    `/Library/Application Support/${name}`,
    `/Library/LaunchAgents/com.${name.toLowerCase()}.plist`,
    path.join(HOME, `Library/LaunchAgents/com.${name.toLowerCase()}.plist`),
  ];

  event.sender.send('uninstall_progress', { step: `Removing ${name}.app` });
  await runCmd(`rm -rf "${appPath}"`).catch(() => {});

  let count = 0;
  for (const r of remnants) {
    if (fs.existsSync(r)) {
      event.sender.send('uninstall_progress', { step: `Removing ${r}` });
      await runCmd(`rm -rf "${r}"`).catch(() => {});
      count++;
    }
  }
  return `Removed ${name} and ${count} related files`;
});

// Run optimization
ipcMain.handle('run_optimization', async (event, { task }) => {
  event.sender.send('optimize_progress', { task, status: 'running' });
  const cmds = {
    flush_dns:               'dscacheutil -flushcache',
    restart_finder:          'killall Finder',
    restart_dock:            'killall Dock',
    purge_memory:            'purge',
    rebuild_launch_services: '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user',
    clear_font_cache:        'atsutil databases -remove',
  };
  const cmd = cmds[task];
  if (!cmd) throw new Error(`Unknown task: ${task}`);
  await runCmd(cmd).catch(() => {});
  event.sender.send('optimize_progress', { task, status: 'done' });
  return `✓ ${task}`;
});

// Scan projects
ipcMain.handle('scan_projects', async () => {
  const roots = ['Projects','dev','GitHub','Work','Documents','Desktop'].map(d => path.join(HOME, d));
  const artifacts = ['node_modules','target','.next','dist','build','.venv','venv','__pycache__','.gradle'];
  const list = [];
  const now = Date.now();

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory());
    for (const entry of entries) {
      for (const art of artifacts) {
        const artPath = path.join(root, entry.name, art);
        if (fs.existsSync(artPath)) {
          const size = await dirSize(artPath);
          const stat = fs.statSync(artPath);
          const isRecent = (now - stat.mtimeMs) < 7 * 86400 * 1000;
          list.push({ name: entry.name, path: artPath, artifact: art, size_bytes: size, size_human: bytesToHuman(size), is_recent: isRecent });
        }
      }
    }
  }
  return list.sort((a, b) => b.size_bytes - a.size_bytes);
});

// ── Malware Scanner ───────────────────────────────────────────────────────────

ipcMain.handle('get_malware_db_info', async () => {
  const bin = getClamScanPath();
  if (!bin) {
    return { version: 'Not installed', last_updated: 'N/A', signatures: 0, is_updating: false, db_path: CLAMAV_DB_DIR };
  }
  try {
    const out = await runCmd(`"${bin}" --version`);
    const parts = out.trim().split('/');
    const version    = (parts[0] || 'ClamAV').trim();
    const signatures = parseInt(parts[1] || '0', 10);
    const updated    = (parts[2] || 'Unknown').trim();
    const updating   = await runCmd('pgrep freshclam').then(() => true).catch(() => false);
    return { version, last_updated: updated, signatures, is_updating: updating, db_path: CLAMAV_DB_DIR };
  } catch {
    return { version: 'Error', last_updated: 'Unknown', signatures: 0, is_updating: false, db_path: CLAMAV_DB_DIR };
  }
});

ipcMain.handle('update_malware_db', async (event) => {
  const bin = getFreshclamPath();
  if (!bin) {
    event.sender.send('db_update_progress', { status: 'error', message: 'freshclam not found. Install ClamAV: brew install clamav' });
    return 'error';
  }

  event.sender.send('db_update_progress', { status: 'starting', message: 'Starting ClamAV database update…' });

  const proc = spawn(bin, ['--stdout', '--no-warnings', `--datadir=${CLAMAV_DB_DIR}`]);

  proc.stdout.on('data', data => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => event.sender.send('db_update_progress', { status: 'progress', message: line.trim() }));
  });
  proc.stderr.on('data', data => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => event.sender.send('db_update_progress', { status: 'progress', message: line.trim() }));
  });
  proc.on('close', code => {
    event.sender.send('db_update_progress', {
      status: code === 0 ? 'done' : 'error',
      message: code === 0 ? 'Database updated successfully ✓' : 'Update failed — check network connection'
    });
  });

  return 'started';
});

ipcMain.handle('run_malware_scan', async (event, { scanPath }) => {
  const bin = getClamScanPath();
  if (!bin) {
    return { total_files: 0, threats: [], duration_secs: 0, status: 'error', error: 'ClamAV not found. Install with: brew install clamav' };
  }

  const start = Date.now();
  event.sender.send('malware_scan_progress', { current_file: 'Initializing scanner…', files_scanned: 0, threats_found: 0, status: 'scanning' });

  const threats = [];
  let filesScanned = 0;

  return new Promise(resolve => {
    const proc = spawn(bin, [
      '--recursive', '--infected', '--stdout', '--no-summary',
      '--follow-file-symlinks=1', '--follow-dir-symlinks=1',
      `--database=${CLAMAV_DB_DIR}`,
      scanPath
    ]);

    proc.stdout.on('data', data => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes(' FOUND')) {
          const match = line.match(/^(.+): (.+) FOUND$/);
          if (match) {
            const threat = { file_path: match[1], threat_name: match[2], severity: classifySeverity(match[2]) };
            threats.push(threat);
            event.sender.send('malware_scan_progress', { current_file: match[1], files_scanned: filesScanned, threats_found: threats.length, status: 'scanning' });
          }
        } else if (line.trim()) {
          filesScanned++;
          if (filesScanned % 500 === 0) {
            event.sender.send('malware_scan_progress', { current_file: line.trim(), files_scanned: filesScanned, threats_found: threats.length, status: 'scanning' });
          }
        }
      }
    });

    proc.on('close', () => {
      const duration = (Date.now() - start) / 1000;
      event.sender.send('malware_scan_progress', { current_file: 'Scan complete', files_scanned: filesScanned, threats_found: threats.length, status: 'done' });
      resolve({ total_files: filesScanned, threats, duration_secs: duration, status: 'done', error: null });
    });

    proc.on('error', err => {
      resolve({ total_files: 0, threats: [], duration_secs: 0, status: 'error', error: err.message });
    });
  });
});

function classifySeverity(name) {
  const n = name.toLowerCase();
  if (n.includes('trojan') || n.includes('ransomware') || n.includes('backdoor') || n.includes('rootkit')) return 'high';
  if (n.includes('adware') || n.includes('pua') || n.includes('spyware')) return 'medium';
  return 'low';
}

ipcMain.handle('quarantine_file', async (event, { filePath }) => {
  const dest = path.join(QUARANTINE_DIR, `${Date.now()}_${path.basename(filePath)}`);
  fs.renameSync(filePath, dest);
  return `Quarantined: ${dest}`;
});

ipcMain.handle('delete_threat', async (event, { filePath }) => {
  fs.unlinkSync(filePath);
  return `Deleted: ${filePath}`;
});
