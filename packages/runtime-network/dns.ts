import { lookup } from "node:dns/promises";
import { selectPinnedPublicAddress, type PublicResolvedAddress } from "@/packages/network-safety";

export interface RuntimeResolver {
  resolve(hostname: string): Promise<readonly string[]>;
}

export const defaultRuntimeResolver: RuntimeResolver = Object.freeze({
  async resolve(hostname: string): Promise<readonly string[]> {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
  },
});

export async function resolvePinnedRuntimeAddress(
  hostname: string,
  resolver: RuntimeResolver = defaultRuntimeResolver,
): Promise<PublicResolvedAddress> {
  const addresses = await resolver.resolve(hostname);
  return selectPinnedPublicAddress(addresses);
}
