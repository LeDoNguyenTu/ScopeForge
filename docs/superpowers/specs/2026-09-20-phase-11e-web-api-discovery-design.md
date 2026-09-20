# Phase 11E web/API stateful discovery design

Status: approved for source implementation under the existing Phase 11 continuation authority. Hosted enablement remains separately gated.
Date: 2026-09-20

## Goal

Add a small first-party stateful discovery provider that can turn evidence from an authorized web/API root into bounded route, API-schema, and API-operation observations. The planner receives only closed capability inputs. It never supplies URLs, headers, bodies, crawl rules, native flags, or arbitrary request configuration.

## Capability surface

- `web.route.discover.v1`
- `api.schema.discover.v1`
- `api.operation.observe.v1`

The initial executable profile is exactly `root-openapi-v1`.

## Network boundary

For one authorized root, the runner may issue at most two unauthenticated GET requests:

1. the exact root path
2. `/openapi.json` on the exact same origin

Redirects are never followed. Cross-origin locations are never requested. HTTPS is required outside the committed legal lab. The legal lab exception is only `http://127.0.0.1`.

The runner accepts the authoritative target locator only from a trusted resolver callback keyed by target node ID. No request URL comes from the planner or target content.

## Budgets

- maximum requests: 2
- maximum runtime supplied by action authorization
- maximum response body: 64 KiB per response
- maximum OpenAPI paths: 32
- maximum operations: 64
- maximum parameters per operation: 16
- methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS only for schema inventory; the discovery runner itself executes GET only
- concurrency: 1
- crawl depth: 0 beyond the two fixed code-owned paths

## Parsing and evidence

Only JSON OpenAPI 3.x documents are parsed. Unknown top-level content is not executed. Route and operation facts are privacy-reduced to status, content type, method, path template, parameter count, and schema version. Response bodies, credentials, cookies, authorization headers, and arbitrary HTML/JSON content are not persisted as observations.

Evidence references are deterministic bounded identifiers. Graph expansion creates one `api` node and bounded `api_operation` children only from accepted schema observations.

## Robots policy

The v1 profile does not crawl arbitrary routes, so robots.txt does not change the two fixed discovery requests. A future crawler requires a separate design before it may enumerate links.

## Failure behavior

Malformed schemas, excessive cardinality, body overflow, target drift, redirect attempts, unsupported schemes, and out-of-scope origins fail closed. A failed schema parse must not create API-operation nodes.

## Release boundary

This source slice does not register a new production worker execution class and does not enable a hosted flag. Legal-lab acceptance must prove zero out-of-scope requests and graph-driven next-iteration eligibility before merge.
