# Future Optional AI Assistance

Status: Phase 4A now defines the provider-neutral domain and advisory contracts required for future integration. ScopeForge still has no AI runtime, model SDK, model network call, or model-driven security decision in the current implementation.

## Architecture already in place

Future assistance must integrate after normalization into `packages/security-domain`. Provider-specific SDKs and prompt formats belong in edge adapters, never in scanner packages or the product domain.

```text
scanner/runtime sources
        |
        v
source adapters
        |
        v
security-domain
        |
        v
advisory context policy
        |
        v
provider-neutral AdvisoryService
        |
        +--> future local provider adapter
        +--> future hosted provider adapter
```

This design keeps local-model support possible and allows hosted providers to be replaced without rewriting scanners, findings, lifecycle rules, or remediation workflows.

## Intended future roles

Potential assistance includes:

- explaining normalized findings and remediation in clearer language
- correlating related findings into candidate security stories
- suggesting follow-up checks for a human operator to review
- clarifying deterministic remediation guidance
- helping rule authors draft detectors and tests behind normal review gates

These functions are advisory. They do not replace deterministic scanning or confirmation.

## Required safety and privacy properties

The Phase 4A contracts establish the following requirements for any later provider implementation:

- deterministic scanners remain authoritative for their observed and scanner-derived conclusions
- advisory results are represented as inferred provenance
- advisory authority cannot promote finding validation state
- model suggestions cannot silently expand scan scope or authorization
- secret-classified context is always excluded from advisory context
- sensitive context cannot reach a remote provider without explicit opt-in
- provider SDK types cannot enter `packages/security-domain`
- local providers must remain possible so sensitive users can keep processing on-device
- model output cannot gain direct scanner, credential, persistence, destructive, or unrestricted network authority
- all core scanner, finding, lifecycle, validation, and remediation workflows must work with no model configured

## What remains deferred

Phase 4A intentionally does not choose or implement OpenAI, Anthropic, Gemini, Ollama, or any other provider. It also does not define model hosting, hardware sizing, billing, prompt storage, conversation UI, vector storage, autonomous agents, or model-driven active testing.

Those choices should be made only when a concrete product workflow needs them. A future implementation should add a small provider adapter behind `AdvisoryService`, apply the existing context policy before the provider boundary, validate returned data into domain-owned result types, and retain explicit human or deterministic confirmation for any security-state change.
