import { canonicalProviderHostname } from "../provider-egress-boundary/policy";

const NONCE = /^[a-f0-9]{64}$/;

export interface ProviderEgressSidecarInput {
  target: Readonly<{ hostname: string; port: number }>;
  sessionNonce: string;
}

function pairs(argv: readonly string[]): Map<string, string> {
  if (argv.length % 2 !== 0) throw new Error("PROVIDER_EGRESS_SIDECAR_ARGUMENTS_INVALID");
  const out = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || out.has(key)) {
      throw new Error("PROVIDER_EGRESS_SIDECAR_ARGUMENTS_INVALID");
    }
    out.set(key, value);
  }
  return out;
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`PROVIDER_EGRESS_SIDECAR_ARGUMENT_REQUIRED:${key}`);
  return value;
}

function targetPort(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error("PROVIDER_EGRESS_SIDECAR_PORT_INVALID");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PROVIDER_EGRESS_SIDECAR_PORT_INVALID");
  }
  return parsed;
}

export function parseProviderEgressSidecarInput(
  argv: readonly string[],
): Readonly<ProviderEgressSidecarInput> {
  const map = pairs(argv);
  const allowed = new Set(["--trusted-hostname", "--port", "--session-nonce"]);
  if ([...map.keys()].some((key) => !allowed.has(key))) {
    throw new Error("PROVIDER_EGRESS_SIDECAR_ARGUMENT_UNKNOWN");
  }

  const hostname = canonicalProviderHostname(required(map, "--trusted-hostname"));
  const port = targetPort(required(map, "--port"));
  const sessionNonce = required(map, "--session-nonce");
  if (!NONCE.test(sessionNonce)) throw new Error("PROVIDER_EGRESS_SIDECAR_NONCE_INVALID");

  return Object.freeze({
    target: Object.freeze({ hostname, port }),
    sessionNonce,
  });
}
