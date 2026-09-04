export type AttackSurfaceV5State = "healthy" | "risk" | "pending";

export type AttackSurfaceV5Entity = Readonly<{
  id: string;
  label: string;
  detail: string;
  state: AttackSurfaceV5State;
  armIndex: number;
}>;

export type AttackSurfaceV5Model = Readonly<{
  entities: readonly AttackSurfaceV5Entity[];
}>;

export function createIllustrativeAttackSurfaceV5Model(): AttackSurfaceV5Model {
  const entities = [
    { id: "web-app", label: "WEB APPLICATION", detail: "2 Findings", state: "risk", armIndex: 0 },
    { id: "sandbox", label: "SANDBOX", detail: "Isolated", state: "healthy", armIndex: 1 },
    { id: "third-party", label: "THIRD PARTY", detail: "Monitored", state: "healthy", armIndex: 2 },
    { id: "data-store", label: "DATA STORE", detail: "At Risk", state: "risk", armIndex: 3 },
    { id: "identity", label: "IDENTITY", detail: "Healthy", state: "healthy", armIndex: 4 },
    { id: "cloud", label: "CLOUD", detail: "Verified", state: "healthy", armIndex: 5 },
  ] satisfies AttackSurfaceV5Entity[];

  return Object.freeze({ entities: Object.freeze(entities.map((entity) => Object.freeze(entity))) });
}
