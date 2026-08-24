import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import * as CDX from "@cyclonedx/cyclonedx-library";

import { compareText } from "../../scanner-core/determinism/compare-text";
import { readInventoryEntry } from "../../scanner-core/filesystem/read-inventory-entry";
import type { RepositoryInventory } from "../../scanner-core/inventory/types";
import { collectNpmDependencies } from "../inventory";
import {
  createNpmPurl,
  isPlainObject,
  type NpmDependencyComponent
} from "../types";
import type { CycloneDxSbomResult, GenerateCycloneDxSbomOptions } from "./types";

interface RootPackageMetadata {
  name: string;
  version?: string;
  purl?: string;
}

function safeNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

async function rootPackageMetadata(inventory: RepositoryInventory): Promise<
  { metadata: RootPackageMetadata; errors: CycloneDxSbomResult["errors"] }
> {
  const fallbackName = basename(inventory.root) || "repository";
  const packageEntry = inventory.entries.find((entry) => entry.path === "package.json");
  if (!packageEntry) return { metadata: { name: fallbackName }, errors: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readInventoryEntry(inventory, packageEntry.path));
  } catch {
    return {
      metadata: { name: fallbackName },
      errors: [{
        code: "invalid_manifest",
        file: packageEntry.path,
        message: "Root package.json could not be parsed safely for SBOM metadata."
      }]
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      metadata: { name: fallbackName },
      errors: [{
        code: "invalid_manifest",
        file: packageEntry.path,
        message: "Root package.json must contain an object for SBOM metadata."
      }]
    };
  }

  const name = safeNonEmptyString(parsed.name) ?? fallbackName;
  const version = safeNonEmptyString(parsed.version);
  return {
    metadata: {
      name,
      ...(version ? { version, purl: createNpmPurl(name, version) } : {})
    },
    errors: []
  };
}

function stableRootBomRef(metadata: RootPackageMetadata): string {
  return metadata.purl ?? `urn:scopeforge:root:${encodeURIComponent(metadata.name)}`;
}

function stableToolBomRef(toolVersion: string): string {
  return `urn:scopeforge:tool:${encodeURIComponent(toolVersion)}`;
}

function uniqueComponents(components: readonly NpmDependencyComponent[]): NpmDependencyComponent[] {
  const byPurl = new Map<string, NpmDependencyComponent>();
  for (const component of components) {
    const previous = byPurl.get(component.purl);
    if (!previous || (!previous.direct && component.direct)) byPurl.set(component.purl, component);
  }
  return [...byPurl.values()].sort(
    (left, right) =>
      compareText(left.name, right.name) ||
      compareText(left.version, right.version) ||
      compareText(left.purl, right.purl)
  );
}

export async function generateCycloneDxSbom(
  repositoryInventory: RepositoryInventory,
  options: GenerateCycloneDxSbomOptions
): Promise<CycloneDxSbomResult> {
  const dependencies = await collectNpmDependencies(repositoryInventory);
  if (dependencies.errors.length > 0) return { errors: dependencies.errors };

  const root = await rootPackageMetadata(repositoryInventory);
  if (root.errors.length > 0) return { errors: root.errors };

  try {
    const rootComponent = new CDX.Models.Component(
      CDX.Enums.ComponentType.Application,
      root.metadata.name,
      {
        bomRef: stableRootBomRef(root.metadata),
        ...(root.metadata.version ? { version: root.metadata.version } : {}),
        ...(root.metadata.purl ? { purl: root.metadata.purl } : {})
      }
    );

    const bom = new CDX.Models.Bom({
      serialNumber: options.serialNumber ?? `urn:uuid:${randomUUID()}`
    });
    bom.metadata.timestamp = options.timestamp ?? new Date();
    bom.metadata.component = rootComponent;
    bom.metadata.tools.components.add(
      new CDX.Models.Component(CDX.Enums.ComponentType.Application, "ScopeForge", {
        bomRef: stableToolBomRef(options.toolVersion),
        version: options.toolVersion
      })
    );

    for (const dependency of uniqueComponents(dependencies.components)) {
      const component = new CDX.Models.Component(
        CDX.Enums.ComponentType.Library,
        dependency.name,
        {
          bomRef: dependency.purl,
          version: dependency.version,
          purl: dependency.purl
        }
      );
      bom.components.add(component);
      if (dependency.direct) rootComponent.dependencies.add(component.bomRef);
    }

    const serializer = new CDX.Serialize.JsonSerializer(
      new CDX.Serialize.JSON.Normalize.Factory(CDX.Spec.Spec1dot7)
    );
    const serialized = serializer.serialize(bom);
    return { sbom: serialized.endsWith("\n") ? serialized : `${serialized}\n`, errors: [] };
  } catch {
    return {
      errors: [{
        code: "sbom_generation_failed",
        message: "CycloneDX SBOM generation failed safely."
      }]
    };
  }
}
