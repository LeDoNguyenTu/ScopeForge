# PR #123 runtime-gate desired-head retention TDD

This branch completed the RED-to-GREEN cycle.

Expected failing behavior: a valid provider-authoritative push whose matching public/private snapshot runtime is disabled returns `runtime_unavailable` before calling `record_github_webhook_push_head`, so the desired head is not retained in automatic-scan state.

The regression test requires the authoritative head to be persisted before reporting runtime unavailability while still proving that no snapshot enqueue occurs.

No production code was changed at the RED checkpoint.

The genuine RED was preserved by GitHub Actions run `35110149012`: both public and private runtime-unavailable cases failed because `recordPushHead` was not called.

The minimal GREEN change moves the matching runtime check until after the provider-authoritative head has been recorded and classified. Replayed, coalesced, and inactive deliveries retain their existing terminal behavior. A newly required enqueue still fails closed when its public/private snapshot runtime is unavailable, and `enqueueProjectSnapshot` is not called.

Focused verification on the GREEN candidate:

- runtime-gate watermark regression
- superseded-head recovery
- webhook service and lifecycle suites
- webhook route suite
- TypeScript typecheck
