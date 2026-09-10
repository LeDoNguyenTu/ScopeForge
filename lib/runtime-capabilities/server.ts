export type HostedCapabilityName =
  | "HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED"
  | "HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED"
  | "HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED"
  | "HOSTED_ACTIVE_CORS_WORKER_ENABLED";

export function serverCapabilityEnabled(
  name: HostedCapabilityName,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[name] === "true";
}
