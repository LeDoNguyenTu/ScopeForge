import { redirect } from "next/navigation";
import { assuranceDestination, readAssuranceState, type MfaAuth } from "@/lib/auth/assurance";

export async function enforceAssuranceForRole(auth: MfaAuth, role: string, returnPath: string): Promise<void> {
  const destination = assuranceDestination(role, await readAssuranceState(auth), returnPath);
  if (destination) redirect(destination);
}
