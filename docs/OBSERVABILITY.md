# Observability Baseline

ScopeForge should expose enough operational telemetry to diagnose failures without logging secrets or sensitive request content.

Planned signals include job lifecycle states, scanner duration, queue delay, finding counts, worker failures and quota rejections. Sensitive evidence belongs in protected artifact storage rather than general application logs.
