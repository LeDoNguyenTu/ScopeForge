import { CheckCircle2, CircleDashed, LockKeyhole } from "lucide-react";
import {
  providerGateSummary,
  type ProviderRuntimeReadiness,
} from "@/lib/provider-runtime/readiness";
import styles from "@/app/dashboard/security-runs/security-runs.module.css";

export default function ProviderRuntimeCard({
  provider,
  compact = false,
}: {
  provider: ProviderRuntimeReadiness;
  compact?: boolean;
}) {
  const gates = providerGateSummary(provider);
  const operational = provider.availability === "operational";

  return (
    <article className={styles.provider}>
      <div className={styles.providerTop}>
        <div>
          <h3>{provider.displayName}</h3>
          <p>{provider.providerId} · v{provider.version}</p>
        </div>
        <span className={operational ? `${styles.status} ${styles.statusGood}` : `${styles.status} ${styles.statusWarn}`}>
          {operational ? "Available now" : "Locked for validation"}
        </span>
      </div>

      <p>{provider.summary}</p>

      <div className={styles.readinessRow}>
        <div>
          <span>Acceptance gates</span>
          <strong>{gates.passed} / {gates.total} passed</strong>
        </div>
        <div className={styles.gateTrack} aria-label={`${gates.passed} of ${gates.total} acceptance gates passed`}>
          {provider.gates.map((gate) => (
            <span
              className={gate.state === "passed" ? styles.gatePassed : gate.state === "pending" ? styles.gatePending : styles.gateLocked}
              key={gate.id}
              title={`${gate.label}: ${gate.state}`}
            />
          ))}
        </div>
      </div>

      {!operational && gates.nextGate ? (
        <div className={styles.nextGate}>
          <span className={styles.nextGateIcon}>
            {gates.nextGate.state === "pending"
              ? <CircleDashed size={14} aria-hidden="true" />
              : <LockKeyhole size={14} aria-hidden="true" />}
          </span>
          <div>
            <small>Next release gate</small>
            <strong>{gates.nextGate.label}</strong>
            {!compact ? <p>{gates.nextGate.detail}</p> : null}
          </div>
        </div>
      ) : (
        <div className={styles.nextGate}>
          <span className={styles.nextGateIcon}><CheckCircle2 size={14} aria-hidden="true" /></span>
          <div><small>Runtime state</small><strong>Operationally accepted</strong></div>
        </div>
      )}
    </article>
  );
}
