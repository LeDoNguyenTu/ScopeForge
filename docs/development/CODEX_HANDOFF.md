# ScopeForge Codex Handoff

Last reconciled: 2026-09-23, Asia/Singapore. Live GitHub/provider state wins.

Phase 11 source, operational acceptance, and its completion task are 100% complete for the approved initial scope. The whole ScopeForge roadmap is about 91% complete because separately gated Phase 6 hosted-runtime enablement and deferred providers remain.

The accepted fifth production canary is run `37fb0091-a7b2-4a33-8a24-6136deb61143`, action `phase11-action:dccb7c2dfc471218d15f53d4f01b44f6f53cc40b64e8a4a8dd8847c13adc354c`, task `1e6d3df7-c1b2-40e9-ba68-704c3fdda12e`, attempt `8c03e311-56c0-4b33-8520-682cb335cd5c`, and observation `phase11-obs-http:79a7ccee5eee6751f948ebd2bee1954f07f2b71a33e49b890b33278ac267f7bb`. Database verdict was `acceptance_ready = true`; Vercel prepare/finalize returned HTTP 200; Oracle cleanup returned `PHASE11_HOST_CLEANUP_PASS`; active Phase 11 tasks are zero; the worker remains enabled.

Do not rerun the Phase 11 acceptance canary. Preserve all five canaries as audit evidence. The temporary verification proof was removed after acceptance.

Hard boundaries:

- ScopeForge Supabase: `tdgpibrepzcvdivztkta`; never use `xwsergbpvkcsugexssmc`.
- Dedicated worker: `cd9a7769-e21f-4f75-84c3-ffe2d1f4616e`.
- Immutable runtime image: `localhost/scopeforge-runtime-worker@sha256:dd3014df27dd6d560b78ed6bdab9081a7da3648604dfdc44c6b35f9246de1c2a`.
- Preserve zero-egress containment, target-bound mediator authority, authorization, cancellation, budgets, RLS/security controls, and service-role-only worker control.
- Do not enable external Nmap, Nuclei, external httpx, broad exploit frameworks, or deferred providers without separate review.
- Do not redesign worker-table RLS from this handoff; the experiment and decision are complete.

