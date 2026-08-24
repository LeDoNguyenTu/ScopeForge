export interface RemediationAction {
  title: string;
  description: string;
}

export interface VerificationGuidance {
  summary: string;
  steps?: readonly string[];
}

export interface RemediationSummary {
  summary: string;
  actions: readonly RemediationAction[];
  verification?: VerificationGuidance;
  references?: readonly string[];
}
