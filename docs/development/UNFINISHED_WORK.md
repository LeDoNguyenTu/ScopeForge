# ScopeForge Unfinished Work

Last reconciled: 2026-10-30, Asia/Bangkok. Live GitHub/provider state wins.

## Active Phase 12 post-v1 work

The approved v1 roadmap remains complete. These are adopted post-v1 Phase 12 items, not reopened v1 blockers:

**Released acceptance baseline: issue #214 / PR #220.** The harness is implemented.
   Exact executable candidate `fad381480dc1961e4e3fcc606112f37851354f9f` passed real
   Oracle external-fixture acceptance and 44 focused Linux tests. Pinned-IP dialing,
   hostile requests, connection/byte/deadline budgets, real-provider cancellation,
   kernel ceilings, scratch exhaustion and cleanup passed. The temporary fixture
   was deleted. Owner-authorized merge `7e62d103afbcf3561461cb2fe329d9cc214b4f08`
   is deployed READY as `dpl_F8BZ15BQbDLcnmYZWB7qGLgsk3TF`; candidate CI
   `41033282669` and main CI `41038513290` passed. See
   `../validation/post-v1/PHASE12_HOST_TUNNEL_ACCEPTANCE.md`.
**Remaining: dedicated Phase 12 worker/control-plane design and operational acceptance.**
   Prepare the separately reviewed authorization/class/queue/database/rollback
   design only after #220. No such enablement or production canary is part of the
   harness. httpx and Nuclei remain default-off.

Issue #213 and PR #218's preparation fixes are released. PR #217 merged as `444d7ffcfb59527d7aa141f4570606b6d9093771`; PR #218 merged as `a577739230a2b717caabfc28e8a33cad2a2e0c64`. Production navigation and redirect checks passed. No navigation/preparation merge gate remains.

Released `main`: `7e62d103afbcf3561461cb2fe329d9cc214b4f08` (PR #220). Existing
provider/sidecar runtime boundaries remain unchanged; the acceptance harness is new.
Issues #212, #213 and #215 are closed. The 2026-10-28 read-only Supabase snapshot
remains historical; this harness work made no database changes.

## Dashboard/MFA correction

No dashboard/MFA correction item remains. PR #203 passed exact-head Linux CI, merged as `eba081c806f8da078a3fd6b84b06de2bfd32ded4`, reached READY production deployment `dpl_6L2DTXRFjpp3WMrj3iWdeLSLogFq`, and passed authenticated read-only rendering. Platform-admin-only mandatory enrollment, enrolled-factor challenges, post-enrollment navigation, optional workspace-role recommendations, capability-aware scan controls, optional repository import, and the factual attack-surface overview are released. No production database or worker change was required.

## Product UX and account security

PRs #186 and #187 are merged, both exact-head CI runs passed, Vercel deployed both merges, and authenticated production rendering confirmed the account-security route, live passkey provider capability, compact navigation, and no document-level overflow across the final viewport matrix. No product UX/account-security closure item remains.

TOTP is the supported AAL2 factor. Email OTP and passkeys must not be relabeled as AAL2. Password/TOTP fallback must remain available if passkeys are provider-disabled.

## Phase 11

No Phase 11 closure blocker remains for the approved initial production scope.

- source implementation: 100%
- operational acceptance: 100%
- completion task: 100%
- accepted run: `37fb0091-a7b2-4a33-8a24-6136deb61143`
- database verdict: `acceptance_ready = true`
- active Phase 11 tasks: zero
- dedicated worker: enabled
- Oracle cleanup: `PHASE11_HOST_CLEANUP_PASS`
- temporary verification proof: removed after acceptance

Preserve all five canaries. Do not run another Phase 11 acceptance canary merely to reconfirm closure.

## Approved roadmap status

No unfinished task remains in the approved ScopeForge v1 roadmap. All 11 delivery phases are complete, so the project completion measure is 100%.

Generic Phase 6D passive/active worker flags, paid or externally administered provider controls, and providers rejected or deferred by reviewed gate decisions are intentional non-v1 scope. If adopted later, each becomes a new roadmap item requiring its own authorization, operational acceptance, rollback evidence, and security review. Their current disabled or unverified state must not be relabeled as active.

Current worktree enumeration shows one local `main` worktree. Recheck remote refs, open PRs and worktree attachments before any future branch deletion; historical cleanup counts are not current evidence.

Do not weaken authorization, network restrictions, containment, worker boundaries, request/runtime budgets, RLS/security controls, or target verification to advance remaining roadmap work.
