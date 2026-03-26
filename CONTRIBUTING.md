# Contributing to SwiftClean

Thank you for your interest in contributing! This document covers how to get set up, what kinds of contributions are welcome, and how to submit changes.

---

## Ways to Contribute

- **Bug reports** — open a GitHub Issue with steps to reproduce
- **Feature requests** — open a GitHub Issue describing the use case
- **Code** — fix a bug, add a feature, improve performance
- **Documentation** — improve README, add inline comments, fix typos
- **Testing** — test on different macOS versions and report results

---

## Development Setup

### Prerequisites

| Tool | Install |
|---|---|
| macOS 12+ | — |
| Xcode CLI Tools | `xcode-select --install` |
| Rust (stable) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Node.js 18+ | `brew install node` |
| Tauri CLI 2 | `cargo install tauri-cli --version "^2.0" --locked` |
| ClamAV | `brew install clamav` |

### Running locally

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/swiftclean
cd swiftclean

# 2. Stage ClamAV sidecar binaries
mkdir -p src-tauri/binaries src-tauri/resources/clamav
ARCH=$(uname -m)
TARGET=$([ "$ARCH" = "arm64" ] && echo "aarch64-apple-darwin" || echo "x86_64-apple-darwin")
BREW_BIN=$(brew --prefix clamav)/bin
cp "$BREW_BIN/clamscan"  "src-tauri/binaries/clamscan-$TARGET"
cp "$BREW_BIN/freshclam" "src-tauri/binaries/freshclam-$TARGET"
chmod +x src-tauri/binaries/*

# 3. Install JS deps
npm install

# 4. Run with hot reload
npm run tauri dev
```

### Build a local DMG

```bash
chmod +x build-dmg.sh && ./build-dmg.sh
# → dist/SwiftClean-1.0.0-arm64.dmg
```

---

## Project Layout

```
swiftclean/
├── index.html          # Entire frontend (vanilla HTML/CSS/JS, no framework)
├── src-tauri/
│   ├── src/lib.rs      # All backend Tauri commands (Rust)
│   └── tauri.conf.json # App configuration
└── .github/
    ├── workflows/      # CI/CD
    └── ISSUE_TEMPLATE/ # Bug / feature templates
```

The frontend (`index.html`) and backend (`lib.rs`) are intentionally kept as single files to make the codebase easy to navigate for first-time contributors.

---

## Making Changes

### Branch naming

```
feat/short-description       # new feature
fix/short-description        # bug fix
docs/short-description       # documentation only
refactor/short-description   # code cleanup, no behaviour change
```

### Commit style (conventional commits)

```
feat: add system memory pressure indicator
fix: clamscan path resolution on Intel Macs
docs: add screenshots to README
refactor: extract disk_usage helper function
chore: update Tauri to 2.1
```

### Pull Request checklist

- [ ] Tested on macOS (Apple Silicon and/or Intel)
- [ ] No new third-party brand names or trademarks introduced
- [ ] `NOTICE` file updated if new third-party dependencies added
- [ ] `Cargo.toml` / `package.json` versions bumped if appropriate

---

## Adding a New Cleaning Category

1. Add a new entry to the `paths` vec in `scan_junk()` inside `src-tauri/src/lib.rs`
2. Add the corresponding UI card in `index.html` if it needs separate display
3. Test that the path exists on a typical Mac before shipping

## Adding a New Backend Command

1. Write the function in `src-tauri/src/lib.rs` with `#[tauri::command]`
2. Register it in the `invoke_handler![]` macro at the bottom of `lib.rs`
3. Call it from the frontend with `invoke('your_command_name', { args })`

---

## Reporting Security Issues

Please **do not** open a public GitHub Issue for security vulnerabilities.  
Email instead: `security@YOUR_DOMAIN` (update this before publishing)

---

## License

By contributing you agree that your changes will be licensed under the [Apache 2.0 License](LICENSE).
