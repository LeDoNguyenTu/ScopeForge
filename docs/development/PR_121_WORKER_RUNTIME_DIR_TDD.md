# Worker runtime directory TDD evidence

This maintenance branch begins with a test-only reproduction. Production code is unchanged at this head.

Expected RED: `tests/worker-runtime/systemd-service.test.ts` rejects the current worker systemd unit because it hardcodes `/run/user/1002` instead of provisioning a runtime directory for the configured `scopeforge-worker` account.

No production schema, runtime gate, credential, provider state, worker identity, or deployment setting is changed by this RED head.
