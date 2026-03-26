# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x (latest) | ✅ Yes |
| < 1.0 | ❌ No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability in SwiftClean, please report it responsibly:

1. Email: `security@YOUR_DOMAIN` *(update before publishing)*
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix if you have one

You will receive a response within **72 hours** acknowledging receipt.  
We aim to release a patch within **14 days** for critical issues.

## Scope

Issues in scope:
- Privilege escalation via cleaning or scanning features
- Arbitrary file deletion outside intended scope
- ClamAV sidecar binary tampering
- Data exfiltration via the app

Out of scope:
- Issues requiring physical access to the machine
- Social engineering attacks
- Issues in ClamAV itself (report to https://www.clamav.net/contact)

## Permissions SwiftClean Requests

SwiftClean requests the following macOS permissions and uses them only as described:

| Permission | Used for |
|---|---|
| File system (Home folder) | Scanning caches, logs, and junk files |
| File system (Applications) | Listing installed apps for uninstaller |
| Network | ClamAV database updates via `freshclam` |
| Automation (Finder, Dock) | Restarting Finder/Dock during optimization |

SwiftClean **never** uploads files, sends telemetry, or contacts any server other than the official ClamAV mirror network (`database.clamav.net`).
