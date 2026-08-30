import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import {
  SCOPEFORGE_ICON_PATH,
  scopeForgeIconMetadata,
} from "@/lib/brand/browser-icons";

describe("ScopeForge browser icons", () => {
  it("uses a dedicated versioned Forge Aperture icon URL for Safari tab identity", () => {
    expect(SCOPEFORGE_ICON_PATH).toBe("/scopeforge-mark-v2.svg");
    expect(scopeForgeIconMetadata.icon).toEqual([
      {
        url: SCOPEFORGE_ICON_PATH,
        type: "image/svg+xml",
        sizes: "any",
      },
    ]);
    expect(scopeForgeIconMetadata.shortcut).toEqual([
      {
        url: SCOPEFORGE_ICON_PATH,
        type: "image/svg+xml",
      },
    ]);
    expect(scopeForgeIconMetadata.apple).toEqual([
      {
        url: SCOPEFORGE_ICON_PATH,
        type: "image/svg+xml",
        sizes: "180x180",
      },
    ]);
  });

  it("publishes installable any and maskable manifest icon entries", () => {
    const value = manifest();
    expect(value.name).toBe("ScopeForge");
    expect(value.icons).toEqual([
      {
        src: SCOPEFORGE_ICON_PATH,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: SCOPEFORGE_ICON_PATH,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ]);
  });
});
