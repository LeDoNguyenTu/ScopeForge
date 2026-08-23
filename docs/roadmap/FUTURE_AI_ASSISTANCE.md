# Future Optional AI Assistance

Status: deferred placeholder only. No AI runtime, model dependency, network dependency, or model-driven security decision is part of the current ScopeForge implementation.

ScopeForge may later add an optional, model-agnostic assistance layer after the core scanner, finding, remediation, verification, and platform workflows are mature. Possible backends could include local/open-source runtimes such as Ollama and large open models, including 120B-class models when practical.

Potential future roles include:

- assisting with finding triage and prioritization
- explaining observed evidence and remediation in clearer language
- correlating related findings into security stories
- suggesting additional authorized pentest checks for a human operator to review
- helping interpret scanner output and likely attack paths
- assisting rule authors with safe detector development and test generation

Non-goals and guardrails for any future design:

- deterministic scanners remain the source of truth for confirmed findings
- model output must be clearly distinguished from observed scanner evidence
- model suggestions must not silently expand scan scope or authorization
- repository content and secrets must not be sent to a remote model without an explicit privacy design and user opt-in
- local model support should remain possible so users can keep sensitive code on-device
- no model may directly perform credential attacks, persistence, destructive actions, or other out-of-scope behavior
- AI assistance must be optional and removable without breaking the core scanner

This placeholder intentionally contains no implementation commitment. The architecture, supported models, local-versus-hosted execution, hardware requirements, privacy controls, and pentest-assistance boundaries should be designed later when the majority of ScopeForge's core software is implemented.
