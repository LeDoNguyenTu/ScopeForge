import type { Metadata, MetadataRoute } from "next";

export const SCOPEFORGE_ICON_PATH = "/scopeforge-mark-v2.svg" as const;

export const scopeForgeIconMetadata = {
  icon: [
    {
      url: SCOPEFORGE_ICON_PATH,
      type: "image/svg+xml",
      sizes: "any",
    },
  ],
  shortcut: [
    {
      url: SCOPEFORGE_ICON_PATH,
      type: "image/svg+xml",
    },
  ],
  apple: [
    {
      url: SCOPEFORGE_ICON_PATH,
      type: "image/svg+xml",
      sizes: "180x180",
    },
  ],
} satisfies NonNullable<Metadata["icons"]>;

export const scopeForgeManifestIcons = [
  {
    src: SCOPEFORGE_ICON_PATH,
    sizes: "any",
    type: "image/svg+xml",
    purpose: "any" as const,
  },
  {
    src: SCOPEFORGE_ICON_PATH,
    sizes: "any",
    type: "image/svg+xml",
    purpose: "maskable" as const,
  },
] satisfies NonNullable<MetadataRoute.Manifest["icons"]>;
