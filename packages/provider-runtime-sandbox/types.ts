export type ExternalProviderKind = "httpx" | "nuclei";

export interface ExternalProviderSandboxInput {
  taskId: string;
  attemptId: string;
  provider: ExternalProviderKind;
  podmanBinary: string;
  providerImage: string;
  sidecarImage: string;
  egressSocketPath: string;
  sessionNonce: string;
  trustedHostname: string;
  port: number;
  providerArgs: readonly string[];
}

export interface ExternalProviderSandboxCommand {
  file: string;
  args: readonly string[];
  containerName: string;
}

export interface ExternalProviderSandboxPlan {
  sidecar: ExternalProviderSandboxCommand;
  provider: ExternalProviderSandboxCommand;
  sidecarName: string;
  providerName: string;
}
