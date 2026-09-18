import { preparePhase11HttpWorker } from "./preparation";
import type {
  Phase11HttpWorkerLeaseIdentity,
  Phase11HttpWorkerPreparationContextRepository,
} from "./preparation-context";

export async function prepareLeasedPhase11HttpWorker(
  input: Phase11HttpWorkerLeaseIdentity,
  dependencies: {
    contextRepository: Phase11HttpWorkerPreparationContextRepository;
    now?: () => Date;
  },
) {
  const state = await dependencies.contextRepository.getPreparationContext(input);
  return preparePhase11HttpWorker({
    taskId: state.binding.taskId,
    workspaceId: state.binding.workspaceId,
    runId: state.binding.runId,
    actionId: state.binding.actionId,
    authorizationId: state.binding.authorizationId,
  }, {
    repository: {
      loadAuthoritativeState: async () => state,
    },
    now: dependencies.now,
  });
}
