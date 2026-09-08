import {
  assertSecurityPackCompatibility,
  inspectSecurityPack,
  loadSecurityPackManifest,
  validateSecurityPackFixtures,
} from "../security-packs";

export async function runPackValidate(
  packDirectory: string,
  currentScopeForgeVersion: string,
): Promise<string> {
  const pack = await loadSecurityPackManifest(packDirectory);
  assertSecurityPackCompatibility(pack.manifest, currentScopeForgeVersion);
  const report = await validateSecurityPackFixtures(pack);
  return `Security Pack valid: ${report.packId}@${report.packVersion} (${report.rules} rules, ${report.cases} cases)\n`;
}

export async function runPackInspect(
  packDirectory: string,
  currentScopeForgeVersion: string,
): Promise<string> {
  const pack = await loadSecurityPackManifest(packDirectory);
  assertSecurityPackCompatibility(pack.manifest, currentScopeForgeVersion);
  return inspectSecurityPack(pack);
}
