# Phase 11 legal labs

Task 11 uses only targets that are deliberately controlled for security testing. These harnesses do not authorize scanning any public system and do not change ScopeForge production runtime authority.

## First-party test API

Run:

```bash
node tests/pentest/labs/scopeforge-test-api.mjs
```

Default origin: `http://127.0.0.1:4311`.

The API exposes deterministic health, OpenAPI, item, and cross-origin redirect fixtures. It binds only to IPv4 loopback. The Vitest Task 11 acceptance starts it on an ephemeral loopback port, verifies its discovery contract, verifies the redirect fixture, and terminates it after the test.

## Third-party vulnerable labs

The opt-in Compose profile contains:

| Lab | Pinned identity | Local origin |
| --- | --- | --- |
| OWASP Juice Shop | release `v20.2.0`, source `5658473cf8814459bf89000ce373b20ed0b4eb37`, image `bkimminich/juice-shop:v20.2.0` | `http://127.0.0.1:4312` |
| DVWA | source `b496a5d3de6b967410155e1b7d3e51e9d035eb22`, image digest `sha256:ed35515e9111801e6e386a6fbb11165508cc7f72e0cb8da4dbb3df70182986c6` | `http://127.0.0.1:4313` |
| MariaDB for DVWA | `10.11.13`, index digest `sha256:24bb6e3d8e46f4581ddcc2b2c22fd78c99c77ac4e3fb7c9aba3a5c4c4d934ca2` | not published |

Start them only when deliberately running a legal-lab acceptance:

```bash
docker compose -f tests/pentest/labs/compose.yml --profile third-party up -d
```

DVWA may require its normal local setup step at `http://127.0.0.1:4313/setup.php` before a test corpus uses it.

Stop and remove the lab containers and volume:

```bash
docker compose -f tests/pentest/labs/compose.yml --profile third-party down -v
```

## Safety boundary

- Published ports are explicitly bound to `127.0.0.1`.
- The Compose `lab` network is `internal: true`, so the lab containers do not receive ordinary external-network egress from that network.
- Third-party vulnerable labs are behind the explicit `third-party` profile and are not started by the normal ScopeForge CI workflow.
- Task 11 tests fail if a vulnerable lab changes to a mutable `latest` image, loses its source pin, publishes a database port, stops using loopback publication, or loses the internal-network boundary.
- No result from these labs may be presented as production vulnerability coverage until a separately reviewed provider-specific run actually measures it.
