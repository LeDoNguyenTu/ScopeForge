# Phase 11 single Codex run closure

Last reconciled: 2026-09-23, Asia/Singapore.

> **Completed:** this runbook is retained as an audit record. Phase 11 acceptance succeeded on the separately authorized fifth canary. Do not use it to queue another acceptance canary.

## Closure result

- Phase 11 source: 100%
- Phase 11 operational acceptance: 100%
- Phase 11 completion task: 100%
- whole ScopeForge project: about 91%

The accepted canary ran once through the existing authenticated production session:

- run: `37fb0091-a7b2-4a33-8a24-6136deb61143`
- action: `phase11-action:dccb7c2dfc471218d15f53d4f01b44f6f53cc40b64e8a4a8dd8847c13adc354c`
- task: `1e6d3df7-c1b2-40e9-ba68-704c3fdda12e`
- worker/action attempt: `8c03e311-56c0-4b33-8520-682cb335cd5c`
- observation: `phase11-obs-http:79a7ccee5eee6751f948ebd2bee1954f07f2b71a33e49b890b33278ac267f7bb`
- evidence ref: `phase11-http-attempt:8c03e311-56c0-4b33-8520-682cb335cd5c:root`

The read-only evidence query returned `acceptance_ready = true`. The run completed with bounded stop reason `request_budget_exhausted`; the task and attempt completed; the action was terminal and approved; exactly one request was charged; provider failures and graph expansions were zero; and no Phase 11 task remained active.

Vercel prepare/finalize returned HTTP 200 with no attributable runtime-error cluster. Oracle host verification returned `PHASE11_HOST_CLEANUP_PASS`, with no remaining exact runtime container or mediator socket. Ordinary evidence did not expose response bodies, credentials, authorization tokens, cookies, worker secrets, or service-role keys.

The temporary `public/.well-known/scopeforge-verification.txt` proof was removed only after acceptance.

## Fixed production identities

- repository: `LeDoNguyenTu/ScopeForge`
- ScopeForge Supabase: `tdgpibrepzcvdivztkta`
- never use Job Command Center Supabase: `xwsergbpvkcsugexssmc`
- worker ID: `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e`
- execution class: `phase11_http_discovery_v1`
- accepted immutable image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`

## Audit and future use

All five terminal canaries are preserved. The fourth failed canary remains the immutable debugging fixture for the terminal-semantics defect fixed by PR #182 and forward-only migration `20260922150155_complete_clean_budget_exhaustion`.

The preflight and evidence SQL helpers now treat all five canaries as historical. They remain read-only and are not authorization to create more canaries.

Do not redesign worker-table RLS as closure work. Preserve authorization, target verification, one-request/5000-ms budgets, zero-egress containment, mediator and worker boundaries, cancellation, RLS/security controls, and service-role-only control. External Nmap, Nuclei, external httpx, broad exploit frameworks, and deferred advanced providers remain disabled unless separately reviewed.

