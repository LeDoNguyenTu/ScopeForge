import { isIP } from "node:net";
import { isBlockedNetworkAddress } from "./ip-policy";

export interface PublicResolvedAddress {
  address: string;
  family: 4 | 6;
}

export function normalizePublicResolvedAddresses(
  addresses: readonly string[],
): readonly PublicResolvedAddress[] {
  if (addresses.length === 0) {
    throw new Error("Target hostname did not resolve.");
  }

  const normalized = [...new Set(addresses.map((address) => address.toLowerCase()))].sort();

  return normalized.map((address) => {
    const family = isIP(address);
    if (family !== 4 && family !== 6) {
      throw new Error("Target DNS returned an invalid address.");
    }
    if (isBlockedNetworkAddress(address)) {
      throw new Error(
        "Target resolves to a private, local, reserved, or otherwise blocked address.",
      );
    }

    return { address, family };
  });
}

export function selectPinnedPublicAddress(
  addresses: readonly string[],
): PublicResolvedAddress {
  const normalized = normalizePublicResolvedAddresses(addresses);
  const selected = normalized[0];
  if (!selected) {
    throw new Error("Target hostname did not resolve.");
  }
  return selected;
}
