<div align="center">

# 🧹 SwiftClean

### Open-source Mac cleaner, optimizer & malware scanner

[![Build](https://github.com/YOUR_USERNAME/swiftclean/actions/workflows/build.yml/badge.svg)](https://github.com/YOUR_USERNAME/swiftclean/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%2012%2B-lightgray.svg)]()
[![Release](https://img.shields.io/github/v/release/YOUR_USERNAME/swiftclean?color=green)](https://github.com/YOUR_USERNAME/swiftclean/releases/latest)
[![Stars](https://img.shields.io/github/stars/YOUR_USERNAME/swiftclean?style=flat)](https://github.com/YOUR_USERNAME/swiftclean/stargazers)

Built with **Tauri 2 + Rust** — ~30 MB DMG, no Homebrew, no Terminal needed for users.

[**Download DMG**](https://github.com/YOUR_USERNAME/swiftclean/releases/latest) · [Report Bug](https://github.com/YOUR_USERNAME/swiftclean/issues/new?template=bug_report.md) · [Request Feature](https://github.com/YOUR_USERNAME/swiftclean/issues/new?template=feature_request.md)

</div>

---

## What it does

SwiftClean is a free, open-source alternative to CleanMyMac for macOS. It gives you deep cleaning, malware scanning, app uninstalling, disk analysis, and live system monitoring — all in a single drag-and-drop app with no subscription and no telemetry.

| Feature | Description |
|---|---|
| 🧹 **Deep Clean** | Removes caches, logs, browser data, Xcode derived data |
| 🛡 **Malware Scanner** | ClamAV-powered — bundled, no install needed, auto-updates DB |
| ⊘ **App Uninstaller** | Removes apps + all preferences, caches, launch agents |
| ⚡ **Optimizer** | Flush DNS, rebuild launch services, restart Finder/Dock |
| ⌫ **Project Purge** | Clean `node_modules`, `target`, `venv`, `dist` from dev projects |
| ◉ **Disk Analyzer** | Visual treemap of folder sizes |
| ◈ **System Status** | Live CPU, RAM, disk, network, and battery metrics |

---

## Install

### Download (no setup required)

1. Go to [**Releases**](https://github.com/YOUR_USERNAME/swiftclean/releases/latest)
2. Download:
   - `SwiftClean-*-arm64.dmg` → Apple Silicon (M1/M2/M3/M4)
   - `SwiftClean-*-x86_64.dmg` → Intel Mac
3. Open the DMG → drag **SwiftClean** to `/Applications`
4. Launch from Applications — that's it

> **"Unidentified developer" warning on first launch?**
> Right-click SwiftClean.app → **Open** → **Open**. Needed once only.
> This goes away permanently if the app is notarized (see [Notarization](#notarization)).

---

## Why SwiftClean?

| | SwiftClean | CleanMyMac | Alternatives |
|---|---|---|---|
| Price | **Free** | $34.95/yr | Varies |
| Open source | **Yes** | No | Rarely |
| Malware scanner | **Bundled** | Add-on | Often paid |
| App size | **~30 MB** | ~50 MB | — |
| Telemetry | **None** | Yes | Unknown |
| macOS 12+ | **Yes** | Yes | — |

---

## Build from Source

### Prerequisites

```bash
xcode-select --install                                     # Xcode CLI tools
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # Rust
brew install node clamav                                   # Node.js + ClamAV
cargo install tauri-cli --version "^2.0" --locked          # Tauri CLI
```

### Run locally

```bash
git clone https://github.com/YOUR_USERNAME/swiftclean
cd swiftclean

# Stage ClamAV sidecar binaries
mkdir -p src-tauri/binaries src-tauri/resources/clamav
TARGET=$([ "$(uname -m)" = "arm64" ] && echo "aarch64-apple-darwin" || echo "x86_64-apple-darwin")
cp "$(brew --prefix clamav)/bin/clamscan"  "src-tauri/binaries/clamscan-$TARGET"
cp "$(brew --prefix clamav)/bin/freshclam" "src-tauri/binaries/freshclam-$TARGET"
chmod +x src-tauri/binaries/*

npm install
npm run tauri dev       # dev server with hot reload
```

### Build DMG

```bash
chmod +x build-dmg.sh && ./build-dmg.sh
# → dist/SwiftClean-1.0.0-arm64.dmg
```

---

## GitHub Actions — Auto-build

Push to GitHub and the DMG builds automatically — no local setup needed.

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/swiftclean.git
git add . && git commit -m "feat: initial release"
git push -u origin main
# → Actions tab → artifacts → SwiftClean-macOS-dmg
```

**Publish a release** (triggers Apple Silicon + Intel builds):
```bash
git tag v1.0.0 && git push origin v1.0.0
```
The DMGs are automatically attached to the GitHub Release page.

---

## How Malware Scanning Works

SwiftClean bundles [ClamAV](https://www.clamav.net/) as a sidecar binary — users never touch the terminal:

```
SwiftClean.app/Contents/
├── MacOS/
│   ├── swiftclean                           ← Main app
│   ├── clamscan-aarch64-apple-darwin        ← Bundled scanner
│   └── freshclam-aarch64-apple-darwin       ← Bundled DB updater
└── Resources/clamav/freshclam.conf         ← Pre-configured
```

- **First scan:** downloads ~300 MB signature database to `~/.swiftclean/clamav-db/`
- **Ongoing:** `freshclam` updates the database silently in the background
- **UI shows:** engine version, signature count, last-updated timestamp, and an "Update Now" button that streams live output

---

## Project Structure

```
swiftclean/
├── index.html                    # Entire frontend (vanilla HTML/CSS/JS)
├── package.json / vite.config.js
├── build-dmg.sh                  # One-command local build
├── LICENSE                       # Apache 2.0
├── NOTICE                        # Third-party attributions
├── CONTRIBUTING.md
├── SECURITY.md
├── .github/
│   ├── workflows/build.yml       # CI: builds DMG on push + release
│   └── ISSUE_TEMPLATE/           # Bug report & feature request templates
└── src-tauri/
    ├── Cargo.toml                # Rust deps
    ├── tauri.conf.json           # App + window + DMG config
    ├── entitlements.plist        # macOS permissions
    ├── binaries/                 # ClamAV sidecars (git-ignored, built by CI)
    ├── resources/clamav/         # freshclam.conf
    └── src/
        ├── main.rs               # Entry point
        └── lib.rs                # All Tauri commands (Rust)
```

---

## Notarization

Removes the "unidentified developer" warning entirely. Requires an Apple Developer account ($99/year):

```bash
# After building:
xcrun notarytool submit dist/SwiftClean-1.0.0-arm64.dmg \
  --apple-id "you@example.com" \
  --password "your-app-specific-password" \
  --team-id "YOUR_TEAM_ID" \
  --wait

xcrun stapler staple dist/SwiftClean-1.0.0-arm64.dmg
```

---

## Tech Stack

| | Technology | Reason |
|---|---|---|
| UI | Vanilla HTML/CSS/JS | No framework overhead |
| Desktop | [Tauri 2](https://tauri.app) (Rust) | ~30 MB vs ~180 MB Electron |
| Webview | WKWebView (macOS native) | No bundled browser |
| Antivirus | [ClamAV](https://www.clamav.net/) | Open-source, GPLv2, Cisco-maintained |
| Build | [Vite 5](https://vitejs.dev/) | Fast dev HMR |

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

- 🐛 [Report a bug](https://github.com/YOUR_USERNAME/swiftclean/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/YOUR_USERNAME/swiftclean/issues/new?template=feature_request.md)
- 🔀 [Open a pull request](https://github.com/YOUR_USERNAME/swiftclean/pulls)

---

## License

Copyright 2025 SwiftClean Contributors

Licensed under the [Apache License, Version 2.0](LICENSE).

SwiftClean bundles [ClamAV](https://www.clamav.net/) (GPL-2.0, © Cisco Systems, Inc.).  
See [NOTICE](NOTICE) for full third-party attributions.
