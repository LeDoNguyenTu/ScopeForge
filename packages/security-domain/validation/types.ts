export type ValidationState =
  | "unvalidated"
  | "static_confirmed"
  | "runtime_observed"
  | "runtime_validated"
  | "user_confirmed";

export type ValidationAuthority = "deterministic" | "human" | "advisory";
