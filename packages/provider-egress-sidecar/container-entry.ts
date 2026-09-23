import { createProviderEgressLoopbackSocksServer } from "../provider-egress-boundary";
import { parseProviderEgressSidecarInput } from "./input";

function safeCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_:.-]{0,127}$/.test(message)
    ? message
    : "PROVIDER_EGRESS_SIDECAR_FAILED";
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGTERM", abort);
  process.once("SIGINT", abort);

  let server: ReturnType<typeof createProviderEgressLoopbackSocksServer> | null = null;
  try {
    const input = parseProviderEgressSidecarInput(process.argv.slice(2));
    server = createProviderEgressLoopbackSocksServer({
      target: input.target,
      sessionNonce: input.sessionNonce,
      signal: controller.signal,
    });
    await server.start();
    await waitForAbort(controller.signal);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: safeCode(error) })}\n`);
    process.exitCode = 1;
  } finally {
    await server?.close().catch(() => {
      process.exitCode = 1;
    });
    process.removeListener("SIGTERM", abort);
    process.removeListener("SIGINT", abort);
  }
}

void main();
