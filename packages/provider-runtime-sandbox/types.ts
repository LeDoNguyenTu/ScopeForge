export type ExternalProviderKind = "httpx" | "nuclei";

export interface ExternalProviderCommonInput {
  taskId: string;
  attemptId: string;
  podmanBinary: string;
  providerImage: string;
  sidecarImage: string;
  egressSocketPath: string;
  sessionNonce: string;
  workspaceId: string;
  actionId: string;
  authorizationId: string;
  targetNodeId: string;
  trustedHostname: string;
  scheme: "http" | "https";
  port: number;
  maxRuntimeMs: number;
}

export interface HttpxExternalProviderSandboxInput extends ExternalProviderCommonInput {
  provider: "httpx";
  probes: readonly ("status" | "title" | "server" | "content_type" | "tls" | "tech")[];
}

export interface NucleiExternalProviderSandboxInput extends ExternalProviderCommonInput {
  provider: "nuclei";
  templateProfile: "baseline-http";
  minimumSeverity: "info" | "low" | "medium" | "high" | "critical";
}

export type ExternalProviderSandboxInput =
  | HttpxExternalProviderSandboxInput
  | NucleiExternalProviderSandboxInput;

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

export interface ExternalProviderSandboxResult {
  output: string;
}

export interface ExternalProviderSandbox {
  execute(
    input: ExternalProviderSandboxInput,
    signal: AbortSignal,
  ): Promise<ExternalProviderSandboxResult>;
}
