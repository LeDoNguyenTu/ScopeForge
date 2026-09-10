import type { AttackSurfaceAssetInput, AttackSurfaceFindingInput } from "@/lib/dashboard/attack-surface-model";
import type { DashboardFinding } from "@/components/dashboard/DashboardWorkbench";

export const demoIdentity = { displayName: "Alex Morgan", workspaceName: "Northstar Security Lab · Demo", role: "Demo viewer" };
const assetRows = [
  ["Customer Portal", "web_application", "https://portal.northstar.example"],
  ["Commerce API", "api", "https://api.northstar.example"],
  ["Identity Service", "api", "https://identity.northstar.example"],
  ["Payments API", "api", "https://payments.northstar.example"],
  ["Checkout Frontend", "repository", "https://git.northstar.example/demo/checkout"],
  ["Infrastructure Config", "repository", "https://git.northstar.example/demo/infrastructure"],
  ["Delivery Pipeline", "repository", "https://git.northstar.example/demo/pipeline"],
  ["Partner Gateway", "web_application", "https://partners.northstar.example"],
] as const;
export const demoAssets = assetRows.map(([name, kind, canonical_target], index) => ({
  id: `demo-asset-${index + 1}`, name, kind, canonical_target,
  verification_status: index < 6 ? "verified" as const : "unverified" as const,
  verified_at: index < 6 ? "2026-09-08T09:00:00Z" : null,
  created_at: `2026-09-0${index + 1}T08:00:00Z`,
})) satisfies (AttackSurfaceAssetInput & { verified_at: string | null })[];

// Illustrative records only. No scanner has run against these reserved example domains.
const findingRows = [
  [0, "Session cookie missing Secure attribute", "high", "in_progress", "A sample response sets the session cookie without Secure.", "Set Secure, HttpOnly and an appropriate SameSite policy, then retest the response."],
  [1, "Overly broad cross-origin policy", "high", "open", "The sample CORS policy accepts an unexpected origin.", "Restrict origins to an explicit allowlist and review credential handling."],
  [2, "Access token included in application logs", "critical", "in_progress", "A sample log statement includes a bearer token field. No real token is stored here.", "Remove token logging, redact sensitive fields and rotate any exposed credentials."],
  [3, "Webhook handler missing signature validation", "critical", "open", "The sample webhook path processes a payload before verifying its signature.", "Validate the provider signature over the raw body before processing events."],
  [4, "Untrusted input reaches a shell command", "critical", "acknowledged", "A sample code path concatenates request input into a shell command.", "Use a non-shell API with explicit arguments and validate allowed inputs."],
  [5, "Storage policy grants broad read access", "high", "in_progress", "The sample infrastructure policy grants read access beyond the intended workload.", "Scope principals and resources to the least privilege required."],
  [6, "Workflow token has write-all permissions", "high", "open", "A sample workflow grants write-all at workflow scope.", "Set read-only defaults and grant narrow permissions per job."],
  [0, "Content Security Policy header missing", "medium", "acknowledged", "The sample HTTPS response has no Content-Security-Policy header.", "Deploy a reviewed nonce-based policy and verify expected application behavior."],
  [7, "Frame ancestor restriction missing", "medium", "open", "The sample page has no frame-ancestors policy.", "Set a frame-ancestors policy aligned with intended embedding."],
  [1, "Verbose error response exposes internal details", "medium", "in_progress", "The sample error response includes an internal stack trace.", "Return generic errors to clients and keep diagnostic details in restricted logs."],
  [3, "Sensitive response allows caching", "medium", "open", "The sample payment response lacks a no-store cache policy.", "Apply Cache-Control: no-store to sensitive responses and verify intermediary behavior."],
  [2, "Redirect destination lacks an allowlist", "medium", "acknowledged", "A sample redirect accepts an arbitrary destination parameter.", "Allow only validated local paths or explicitly approved destinations."],
  [4, "TLS certificate verification disabled", "high", "in_progress", "The sample client disables certificate validation.", "Restore certificate verification and configure the required trust roots."],
  [5, "Container runs as the root user", "medium", "open", "The sample container configuration does not select an unprivileged user.", "Use a dedicated non-root UID and drop unnecessary capabilities."],
  [6, "Third-party action uses a mutable tag", "medium", "in_progress", "A sample workflow references an action by a mutable tag.", "Pin the action to a reviewed commit and maintain an update process."],
  [7, "Referrer Policy header missing", "low", "open", "The sample response does not specify Referrer-Policy.", "Choose a referrer policy that limits disclosure across origins."],
  [0, "Server header reveals platform details", "low", "acknowledged", "The sample response includes a detailed server version header.", "Remove unnecessary version headers and keep the platform patched."],
  [4, "Dependency inventory needs review", "info", "open", "The example dependency inventory is waiting for an owner review.", "Review the inventory and assign ownership for dependency maintenance."],
] as const;
export const demoFindings = findingRows.map(([asset, title, severity, lifecycle_state, evidence, remediation], index) => ({
  finding_id: `demo-finding-${index + 1}`, asset_id: demoAssets[asset].id,
  title, severity, lifecycle_state, evidence, remediation,
  last_seen_at: "2026-09-10T08:30:00Z", first_seen_at: "2026-09-08T09:30:00Z",
  confidence: "inferred", validation_state: "unvalidated", source_id: "portfolio-demo",
  owner: ["Alex Morgan", "Jordan Lee", "Sam Rivera"][index % 3],
})) satisfies (DashboardFinding & AttackSurfaceFindingInput & { evidence: string; remediation: string; first_seen_at: string; confidence: string; validation_state: string; source_id: string; owner: string })[];
