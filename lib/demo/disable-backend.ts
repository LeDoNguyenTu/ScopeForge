/** This branch is a fixture-only portfolio demo, never a database client. */
export function disableDemoBackend(): void {
  throw new Error("Demo database access is disabled. This deployment uses read-only sample data.");
}
