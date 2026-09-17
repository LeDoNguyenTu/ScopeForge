# Future: backup platform administrators and access control

User request, 2026-09-16: support granting another account backup platform-admin privileges, with access-control management (ACM). Explicitly deferred until core software/release work is finished. This document does not authorize a privilege grant or implement a delegation endpoint.

Keep platform administration separate from workspace membership. Member/viewer collaborator controls must never grant platform admin or workspace owner/admin roles.

Before implementation, define the exact ACM requirements with the owner. Proposed acceptance scope:

- Only a verified platform owner can nominate a confirmed existing account; require recent authentication and deliberate confirmation.
- Granular permissions, least privilege, revoke/suspend controls, and a visible list of who has access.
- Preserve at least one recoverable platform owner; prohibit self-escalation and unreviewed owner transfer.
- Record actor, target, reason, prior/new permissions and timestamps in protected audit history; no credentials in logs.
- Test role boundaries, concurrent changes, revoked sessions, recovery/rollback, and real owner/backup-account browser flows.
- Implement forward-only schema changes after review; preserve default-deny RLS and server-only administration credentials.

Immediate visual request is in scope now: give the existing Platform admin entry a distinct outlined treatment and spacing from Resources. Privilege delegation remains deferred.
