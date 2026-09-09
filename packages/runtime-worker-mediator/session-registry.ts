import { randomBytes as nodeRandomBytes } from "node:crypto";
import {
  RuntimeMediatorProtocolError,
  type RuntimeMediatorExecutionClass,
  type RuntimeMediatorRunRequest,
  type RuntimeMediatorSessionIdentity,
} from "./contracts";
import { validateRuntimeMediatorRunRequest } from "./validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RuntimeMediatorSessionRegistration<TProfile> {
  taskId: string;
  attemptId: string;
  executionClass: RuntimeMediatorExecutionClass;
  expiresAt: string;
  profile: TProfile;
}

export interface RuntimeMediatorSessionRegistryOptions {
  randomBytes?: (size: number) => Buffer;
}

interface SessionRecord<TProfile> {
  readonly identity: RuntimeMediatorSessionIdentity;
  readonly expiresAtMs: number;
  readonly profile: TProfile;
}

function attemptKey(input: Pick<RuntimeMediatorSessionIdentity, "taskId" | "attemptId">): string {
  return `${input.taskId}:${input.attemptId}`;
}

function sessionKey(identity: RuntimeMediatorSessionIdentity): string {
  return `${identity.taskId}:${identity.attemptId}:${identity.executionClass}:${identity.nonce}`;
}

function assertRegistration<TProfile>(input: RuntimeMediatorSessionRegistration<TProfile>): number {
  if (!UUID_PATTERN.test(input.taskId)
      || !UUID_PATTERN.test(input.attemptId)
      || (input.executionClass !== "passive_runtime_observation_v1"
        && input.executionClass !== "active_cors_validation_v1")) {
    throw new RuntimeMediatorProtocolError("MEDIATOR_SESSION_INVALID");
  }
  const expiresAtMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    throw new RuntimeMediatorProtocolError("MEDIATOR_SESSION_INVALID");
  }
  return expiresAtMs;
}

export function createRuntimeMediatorSessionRegistry<TProfile>(
  options: RuntimeMediatorSessionRegistryOptions = {},
) {
  const sessions = new Map<string, SessionRecord<TProfile>>();
  const boundAttempts = new Set<string>();
  const usedSessions = new Set<string>();
  const randomBytes = options.randomBytes ?? nodeRandomBytes;

  function register(input: RuntimeMediatorSessionRegistration<TProfile>): RuntimeMediatorSessionIdentity {
    const expiresAtMs = assertRegistration(input);
    const bindingKey = attemptKey(input);
    if (boundAttempts.has(bindingKey)) {
      throw new RuntimeMediatorProtocolError("MEDIATOR_SESSION_INVALID");
    }

    const secret = randomBytes(32);
    if (!Buffer.isBuffer(secret) || secret.length !== 32) {
      throw new RuntimeMediatorProtocolError("MEDIATOR_SESSION_INVALID");
    }

    const identity = Object.freeze({
      taskId: input.taskId,
      attemptId: input.attemptId,
      executionClass: input.executionClass,
      nonce: secret.toString("hex"),
    });
    const key = sessionKey(identity);
    sessions.set(key, Object.freeze({ identity, expiresAtMs, profile: input.profile }));
    boundAttempts.add(bindingKey);
    return identity;
  }

  function consume(request: RuntimeMediatorRunRequest, now: Date): TProfile {
    const validated = validateRuntimeMediatorRunRequest(request);
    const key = sessionKey(validated.session);
    if (usedSessions.has(key)) {
      throw new RuntimeMediatorProtocolError("MEDIATOR_SESSION_USED");
    }

    const record = sessions.get(key);
    if (!record) {
      throw new RuntimeMediatorProtocolError("MEDIATOR_SESSION_INVALID");
    }
    if (!Number.isFinite(now.getTime()) || record.expiresAtMs <= now.getTime()) {
      sessions.delete(key);
      usedSessions.add(key);
      throw new RuntimeMediatorProtocolError("MEDIATOR_SESSION_EXPIRED");
    }

    sessions.delete(key);
    usedSessions.add(key);
    return record.profile;
  }

  return Object.freeze({ register, consume });
}
