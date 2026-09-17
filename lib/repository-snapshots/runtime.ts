import { serverCapabilityEnabled } from "@/lib/runtime-capabilities/server";

export const HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = serverCapabilityEnabled(
  "HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED",
);

export const HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED = serverCapabilityEnabled(
  "HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED",
);
