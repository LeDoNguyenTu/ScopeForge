export const SCAN_EXIT = {
  SUCCESS: 0,
  POLICY_FAILED: 1,
  USAGE_ERROR: 2,
  SCANNER_ERROR: 3
} as const;

export type ScanExitCode = (typeof SCAN_EXIT)[keyof typeof SCAN_EXIT];
