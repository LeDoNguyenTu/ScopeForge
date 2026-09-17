import type { ExecutionMode } from "../security-planning";
import type {
  CapabilityProvider,
  ProviderRegistration,
  ProviderSelection,
} from "./types";

export interface CapabilityRegistry {
  providers(): readonly CapabilityProvider[];
  select(capabilityId: string, mode: ExecutionMode): ProviderSelection;
}

function validateRegistration(registration: ProviderRegistration): void {
  const { provider, priority } = registration;
  if (!provider.providerId.trim() || !provider.version.trim()) throw new Error("PROVIDER_IDENTITY_INVALID");
  if (provider.capabilityIds.length === 0 || provider.capabilityIds.some((id) => !id.trim())) {
    throw new Error("PROVIDER_CAPABILITIES_REQUIRED");
  }
  if (provider.supportedModes.length === 0) throw new Error("PROVIDER_MODES_REQUIRED");
  if (!Number.isInteger(priority)) throw new Error("PROVIDER_PRIORITY_INVALID");
}

function healthRank(health: ProviderRegistration["health"]): number {
  return health === "healthy" ? 0 : health === "degraded" ? 1 : 2;
}

export function createCapabilityRegistry(
  registrations: readonly ProviderRegistration[],
): CapabilityRegistry {
  const byProviderId = new Map<string, ProviderRegistration>();

  for (const registration of registrations) {
    validateRegistration(registration);
    if (byProviderId.has(registration.provider.providerId)) {
      throw new Error(`PROVIDER_DUPLICATE:${registration.provider.providerId}`);
    }
    byProviderId.set(registration.provider.providerId, Object.freeze({
      ...registration,
      provider: registration.provider,
    }));
  }

  const ordered = Object.freeze(
    [...byProviderId.values()].sort((a, b) => a.provider.providerId.localeCompare(b.provider.providerId)),
  );

  return Object.freeze({
    providers: () => Object.freeze(ordered.map((registration) => registration.provider)),
    select: (capabilityId: string, mode: ExecutionMode): ProviderSelection => {
      const capabilityProviders = ordered.filter((registration) =>
        registration.provider.capabilityIds.includes(capabilityId),
      );
      if (capabilityProviders.length === 0) return { ok: false, code: "UNKNOWN_CAPABILITY" };

      const modeProviders = capabilityProviders.filter((registration) =>
        registration.provider.supportedModes.includes(mode),
      );
      if (modeProviders.length === 0) return { ok: false, code: "MODE_UNSUPPORTED" };

      const enabled = modeProviders.filter((registration) => registration.enabled);
      if (enabled.length === 0) return { ok: false, code: "PROVIDER_DISABLED" };

      const available = enabled.filter((registration) => registration.health !== "unavailable");
      if (available.length === 0) return { ok: false, code: "PROVIDER_UNAVAILABLE" };

      const selected = [...available].sort((a, b) =>
        healthRank(a.health) - healthRank(b.health)
        || b.priority - a.priority
        || a.provider.providerId.localeCompare(b.provider.providerId),
      )[0];

      return { ok: true, provider: selected.provider };
    },
  });
}
