# Phase 11 completion matrix

Last reconciled: 2026-09-21, Asia/Singapore.

This matrix separates source completion from operational enablement. Default-off or deferred external providers are not release blockers unless a capability is required by the supported Phase 11 flow.

| Task | Source status | Operational status |
| --- | --- | --- |
| 1 security graph | complete | released |
| 2 hypotheses | complete | released |
| 3 policy | complete | released |
| 4 provider contract | complete | released |
| 5 registry | complete | released |
| 6 native observations | complete | released |
| 7 deterministic planner | complete | released |
| 8 persistence | complete | production migration released |
| 9 run orchestration | complete | released |
| 10 first provider slice | complete for bounded HTTP plus Nmap/Nuclei adapter contracts | HTTP production canary must pass after worker fix; external Nmap/Nuclei/httpx remain separately gated |
| 11 adaptive evaluation | complete | permanent CI benchmark gate |
| 12 web/API stateful discovery | complete | source released, hosted expansion remains bounded/default-off |
| 13 sessions/browser | complete | session migration released; hosted browser execution remains default-off |
| 14 proof-only validation | complete | source released; non-lab execution remains approval-gated/default-off |
| 15 continuous validation | complete | source released |
| 16 advanced providers | evaluation complete | all candidates deferred until a measured capability gap justifies them |

## Remaining operational gate

Two bounded Phase 11 production HTTP canaries reached the dedicated worker and preserved one-request accounting, but failed before sandbox execution. PR #159 moved the host mediator socket into the systemd-owned writable runtime directory; the resulting 109-byte pathname then reproduced `listen EINVAL` on the accepted Oracle Linux host. The active corrective branch shortens only the private host subdirectory to `/run/scopeforge-worker/mediator`, producing a 101-byte pathname while retaining the 64-hex random filename, in-container mediator path, and all sandbox limits.

Phase 11 operational completion requires:

1. release the mediator runtime-directory fix
2. deploy the rebuilt worker bundle to the dedicated accepted Linux host
3. rerun exactly one verified-asset root-only canary
4. confirm one request, terminal run/action/task state, an observation or valid no-signal result, coverage reconciliation, no leaked response body/secrets, and no remaining container/socket
5. record the evidence and remove the temporary proof-of-control file

No external Nmap, Nuclei, httpx, broad exploit framework, or advanced Task 16 provider should be enabled merely to close this gate.
