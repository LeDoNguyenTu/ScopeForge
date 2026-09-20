# Phase 11F authenticated browser and session design

Status: approved for source implementation. Hosted browser execution remains default-off until the release gate is explicitly accepted.
Date: 2026-09-20

## Goal

Add credential/session authority without placing reusable secrets in planner state, database read models, observations, evidence payloads, model prompts, screenshots, or ordinary logs.

## Secret boundary

The planner may reference only a short-lived `sessionLeaseId`. A trusted server component creates the lease from an opaque credential reference. The database stores only SHA-256 of that opaque reference. The actual credential is resolved at execution time by a trusted secret resolver and exists only in worker memory for the closed login action.

A lease is bound to:

- workspace
- Phase 11 run
- authorization snapshot
- target node
- identity
- credential class
- session class
- expiry
- revocation state

Any drift fails closed.

## Closed semantic browser actions

V1 supports exactly:

- `browser.login.perform.v1`
- `browser.route.discover.v1`
- `browser.session.compare_roles.v1`
- `api.authorization.compare.v1`

There is no arbitrary JavaScript, arbitrary selector, arbitrary URL, unrestricted download, unrestricted upload, or cross-origin navigation interface.

The executable login profile has code-owned semantics:

1. navigate to an exact same-origin login path
2. fill the code-owned username field
3. fill the code-owned password field
4. click the code-owned submit control
5. wait for an exact same-origin success path
6. collect only a redacted route/DOM summary

## Evidence reduction

Browser evidence may contain route, status-like state, a bounded visible-text fingerprint, and bounded structural counts. Values from password fields, credential resolver output, cookies, local/session storage, authorization headers, and full DOM/screenshot content are excluded.

## Cross-identity comparison

Two identity leases are required. Both must bind to the same workspace, run, target node, and authorization snapshot, and they must represent different identity IDs. A comparison may observe only the same code-owned route under both sessions.

## Containment

Real-browser acceptance uses ChromeDriver against a local `127.0.0.1` lab. It proves same-origin navigation, two authorized identities, rejection of external navigation, and absence of lab credentials from the emitted summary.

No hosted browser worker class is enabled by this source slice.
