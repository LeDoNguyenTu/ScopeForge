# Threat Model Baseline

Primary Phase 1 risks:

- Cross-workspace data access
- Session misuse
- Privileged database credentials exposed to the browser
- Authentication abuse
- Misleading capability claims that encourage unsafe scanner use

Controls include Row Level Security, server-side session validation, publishable browser credentials only, layered authentication abuse controls and delayed activation of scanning until scope enforcement exists.
