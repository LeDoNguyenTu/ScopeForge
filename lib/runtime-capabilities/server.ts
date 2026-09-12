export type HostedCapabilityName =
  | "HOSTED_GITHUB_INTEGRATION_ENABLED"
  | "HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED"
  | "HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED"
  | "HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED"
  | "HOSTED_ACTIVE_CORS_WORKER_ENABLED";

export type CapabilityEnvironment = Readonly<Partial<Record<HostedCapabilityName, string>>>;

export function serverCapabilityEnabled(
  name: HostedCapabilityName,
  env: CapabilityEnvironment = process.env as CapabilityEnvironment,
): boolean {
  return env[name] === "true";
}