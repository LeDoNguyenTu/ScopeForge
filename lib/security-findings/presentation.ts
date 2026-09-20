const SOURCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  iac: "Infrastructure configuration analysis",
  jsts: "JavaScript and TypeScript code analysis",
  sca: "Dependency vulnerability analysis",
  secrets: "Secret exposure analysis",
});

export function humanizeSecurityValue(value: string): string {
  const words = value.trim().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
  if (!words) return "Unknown";
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function findingSourceLabel(sourceId: string, sourceKind?: string): string {
  const scanner = /^scopeforge:([^:]+):/.exec(sourceId)?.[1];
  if (scanner && SOURCE_LABELS[scanner]) return SOURCE_LABELS[scanner];

  if (sourceKind?.includes("runtime")) return "Runtime security validation";
  if (sourceKind?.includes("repository")) return "Repository security analysis";
  if (sourceKind?.includes("scanner")) return "ScopeForge deterministic analysis";
  return "ScopeForge security analysis";
}

export function findingTechnicalRuleLabel(ruleRef: string): string {
  const withoutNamespace = ruleRef.replace(/^phase3-rule:/, "");
  const versionSeparator = withoutNamespace.lastIndexOf("@");
  if (versionSeparator < 0) return withoutNamespace;
  return `${withoutNamespace.slice(0, versionSeparator)} · version ${withoutNamespace.slice(versionSeparator + 1)}`;
}
