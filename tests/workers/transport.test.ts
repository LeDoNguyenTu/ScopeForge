import { describe, expect, it } from "vitest";
import {
  assertNoWorkerRequestBody,
  WorkerTransportError,
} from "@/lib/worker-control/transport";

function streamedPost(body: string): Request {
  return new Request("https://scopeforge.dev/api/internal/workers/claim", {
    method: "POST",
    body,
  });
}

describe("worker control transport", () => {
  it("accepts a platform-normalized empty POST stream", async () => {
    await assertNoWorkerRequestBody(streamedPost(""));
  });

  it("rejects any bytes in a no-body worker request", async () => {
    await expect(
      assertNoWorkerRequestBody(streamedPost("{")),
    ).rejects.toBeInstanceOf(WorkerTransportError);
  });
});
