# Phase 11 completion matrix

Last reconciled: 2026-09-22, Asia/Singapore.

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

## Operational acceptance

Five bounded Phase 11 production HTTP canaries reached the dedicated worker and remain preserved as audit evidence.

The first canary exposed a mediator host-directory mismatch. PR #159 moved the host mediator socket into the systemd-owned writable runtime directory.

The second canary then reproduced the Linux Unix-socket pathname limit: the generated 109-byte host pathname failed with `listen EINVAL`. PR #163 shortened only the private host subdirectory to `/run/scopeforge-worker/mediator`, producing a 101-byte pathname while preserving the 64-hex random filename, in-container mediator path, authorization boundary, and sandbox limits.

The third canary passed the corrected socket boundary but production preparation returned HTTP 409 before sandbox execution. The claim RPC had correctly moved the action to `running`, while trusted preparation accepted only `enqueueing` or `queued`. PR #164 released the regression fix so the authenticated post-claim `running` state is valid.

The fourth canary on 2026-09-22 passed preparation, sandbox execution, one-request accounting, observation persistence, finalization, Vercel runtime checks, and Oracle cleanup. Its worker/action attempt succeeded, but the parent run became `failed / request_budget_exhausted`; therefore `acceptance_ready` remained false only for `run_completed`. The confirmed fix prioritizes provider failure when failure and budget ceilings coincide and maps clean request-budget exhaustion to completed through a forward-only migration. Preserve the fourth canary unchanged and do not run another in the same authorized run.

The separately authorized fifth canary completed operational acceptance on 2026-09-23. Run `37fb0091-a7b2-4a33-8a24-6136deb61143`, task `1e6d3df7-c1b2-40e9-ba68-704c3fdda12e`, attempt `8c03e311-56c0-4b33-8520-682cb335cd5c`, and observation `phase11-obs-http:79a7ccee5eee6751f948ebd2bee1954f07f2b71a33e49b890b33278ac267f7bb` passed every database acceptance check. Vercel prepare/finalize returned HTTP 200 with no runtime errors, Oracle cleanup returned `PHASE11_HOST_CLEANUP_PASS`, and the temporary proof-of-control file was removed afterward.

Phase 11 source and operational acceptance are complete for the approved initial production scope.

No external Nmap, Nuclei, httpx, broad exploit framework, or advanced Task 16 provider should be enabled merely to close this gate.
