import type { RequestOptions } from "node:https";

export const PASSIVE_RUNTIME_USER_AGENT = "ScopeForge-RuntimeObserver/0.1" as const;
export const ACTIVE_RUNTIME_USER_AGENT = "ScopeForge-RuntimeValidator/0.1" as const;
export const SCOPEFORGE_SYNTHETIC_ORIGIN = "https://scopeforge.invalid" as const;

export interface RuntimeTlsMetadata {
  protocol: string | null;
  validFrom: string | null;
  validTo: string | null;
  subjectAltName: string | null;
}

export interface RuntimeNetworkResponse {
  status: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  tls: RuntimeTlsMetadata;
}

export type RuntimeRequester = (options: RequestOptions) => Promise<RuntimeNetworkResponse>;

export interface TrustedRuntimeRequestPlan {
  readonly method: "GET";
  readonly url: URL;
  readonly timeoutMs: number;
  readonly headers: Readonly<{
    accept: "*/*";
    "user-agent": typeof PASSIVE_RUNTIME_USER_AGENT | typeof ACTIVE_RUNTIME_USER_AGENT;
    origin?: typeof SCOPEFORGE_SYNTHETIC_ORIGIN;
  }>;
}

export interface RuntimeNetworkDependencies {
  resolver?: import("./dns").RuntimeResolver;
  requester?: RuntimeRequester;
  now?: () => number;
  signal?: AbortSignal;
}
