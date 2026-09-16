# PR #123 runtime-gate desired-head retention TDD

This branch is currently at the RED stage.

Expected failing behavior: a valid provider-authoritative push whose matching public/private snapshot runtime is disabled returns `runtime_unavailable` before calling `record_github_webhook_push_head`, so the desired head is not retained in automatic-scan state.

The regression test requires the authoritative head to be persisted before reporting runtime unavailability while still proving that no snapshot enqueue occurs.

No production code is changed at this RED checkpoint.
