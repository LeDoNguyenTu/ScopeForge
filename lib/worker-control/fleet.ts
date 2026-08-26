import type { WorkerControlRepository } from "./repository";
import type { WorkerFleetSnapshot } from "./types";

export async function loadWorkerFleetSnapshot(
  repository: Pick<WorkerControlRepository, "fleetSnapshot">,
): Promise<WorkerFleetSnapshot> {
  return repository.fleetSnapshot();
}
