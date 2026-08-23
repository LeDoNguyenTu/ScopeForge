export type InventorySkipReason =
  | "default_exclude"
  | "gitignore"
  | "scopeforgeignore"
  | "symlink"
  | "file_too_large"
  | "file_limit"
  | "total_bytes_limit"
  | "unreadable";

export interface InventoryBudgets {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export const defaultInventoryBudgets: InventoryBudgets = {
  maxFiles: 20_000,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024
};

export type InventoryEntryKind =
  | "source"
  | "manifest"
  | "lockfile"
  | "infrastructure"
  | "config"
  | "other";

export interface InventoryEntry {
  path: string;
  size: number;
  kind: InventoryEntryKind;
  language?: string;
}

export type InventorySkipCounts = Record<InventorySkipReason, number>;

export interface RepositoryInventorySummary {
  filesAnalyzed: number;
  filesSkipped: number;
  totalBytes: number;
  languages: Record<string, number>;
  manifests: string[];
  infrastructure: string[];
  skippedByReason: InventorySkipCounts;
}

export interface RepositoryInventory {
  root: string;
  entries: InventoryEntry[];
  summary: RepositoryInventorySummary;
}
