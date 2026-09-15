import {
  GitHubWebhookInputError,
  readGitHubWebhookRequest,
} from "@/lib/github-app/webhook";
import {
  processGitHubWebhook,
  type GitHubWebhookResult,
} from "@/lib/github-app/webhook-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function successStatus(result: GitHubWebhookResult): 200 | 202 {
  return result.status === "queued" || result.status === "pending" ? 202 : 200;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const verified = await readGitHubWebhookRequest(request);
    const result = await processGitHubWebhook(verified);

    return json({ ok: true, data: result }, successStatus(result));
  } catch (error) {
    if (error instanceof GitHubWebhookInputError) {
      return json({ ok: false, error: error.code }, error.status);
    }

    return json(
      { ok: false, error: "GITHUB_WEBHOOK_PROCESSING_FAILED" },
      503,
    );
  }
}
