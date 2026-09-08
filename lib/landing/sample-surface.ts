// Public demo records only. No workspace data is exposed on the landing page.
export const sampleAssets = [
  { id: "web", name: "Web application", verified: true, x: 205, y: 485 },
  { id: "api", name: "API services", verified: true, x: 105, y: 290 },
  { id: "cloud", name: "Cloud", verified: false, x: 190, y: 155 },
  { id: "sandbox", name: "Sandbox", verified: true, x: 445, y: 95 },
  { id: "partner", name: "Third party", verified: true, x: 640, y: 215 },
  { id: "store", name: "Data store", verified: true, x: 655, y: 425 },
  { id: "identity", name: "Identity", verified: true, x: 450, y: 565 },
] as const;
export const sampleFindings = [
  { id: "web-auth", assetId: "web", title: "Missing access check" },
  { id: "web-secret", assetId: "web", title: "Exposed service credential" },
  { id: "store-access", assetId: "store", title: "Broad data access" },
] as const;
export const sampleExposurePath = ["web", "identity", "store"] as const;
export function buildSampleSurface(remediated = false) {
  const findings = remediated ? [] : [...sampleFindings];
  const path = remediated ? [] : [...sampleExposurePath];
  const nodes = sampleAssets.map(asset => ({ ...asset, findings: findings.filter(finding => finding.assetId === asset.id), onPath: path.some(id => id === asset.id) }));
  const verified = nodes.filter(node => node.verified).length;
  return { nodes, findings, path, metrics: { assets: nodes.length, findings: findings.length, affected: nodes.filter(node => node.findings.length > 0).length, verified, pending: nodes.length - verified, coverage: nodes.length ? Math.round(verified / nodes.length * 100) : 0 } };
}
export type SampleSurface = ReturnType<typeof buildSampleSurface>;
