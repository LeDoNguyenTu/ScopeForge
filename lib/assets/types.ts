export type AssetKind = "web_application" | "api" | "repository";

export type NormalizedAssetTarget = {
  canonicalTarget: string;
  hostname: string | null;
  kind: AssetKind;
};

export type VerificationResult = {
  verified: boolean;
  reason: string;
};
