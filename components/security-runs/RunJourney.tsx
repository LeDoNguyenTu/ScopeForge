import { CheckCircle2, CircleDashed, FileSearch, Radar, ShieldCheck } from "lucide-react";
import styles from "@/app/dashboard/security-runs/security-runs.module.css";

export default function RunJourney({
  status,
  actionCount,
  observationCount,
  coveredNodeCount,
  stopReason,
}: {
  status: string;
  actionCount: number;
  observationCount: number;
  coveredNodeCount: number;
  stopReason: string | null;
}) {
  const terminal = status === "completed" || status === "failed" || status === "cancelled";
  const steps = [
    {
      label: "Scope authorized",
      detail: "The run is bound to a verified workspace asset and immutable authorization snapshot.",
      done: true,
      Icon: ShieldCheck,
    },
    {
      label: "Actions planned",
      detail: `${actionCount} bounded action${actionCount === 1 ? "" : "s"} recorded for this run.`,
      done: actionCount > 0,
      Icon: Radar,
    },
    {
      label: "Coverage executed",
      detail: `${coveredNodeCount} graph node${coveredNodeCount === 1 ? "" : "s"} covered under server-owned budgets.`,
      done: coveredNodeCount > 0 || terminal,
      Icon: CircleDashed,
    },
    {
      label: "Evidence reduced",
      detail: `${observationCount} normalized observation${observationCount === 1 ? "" : "s"} persisted without raw provider authority.`,
      done: terminal,
      Icon: FileSearch,
    },
  ];

  return (
    <section className={styles.panel} aria-labelledby="run-journey-heading">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelKicker}>End-to-end execution</span>
          <h2 id="run-journey-heading">Run journey</h2>
        </div>
        <span className={styles.status}>{stopReason ? stopReason.replaceAll("_", " ") : status.replaceAll("_", " ")}</span>
      </div>
      <div className={styles.journey}>
        {steps.map(({ label, detail, done, Icon }, index) => (
          <article className={done ? `${styles.journeyStep} ${styles.journeyDone}` : styles.journeyStep} key={label}>
            <div className={styles.journeyMarker}>
              {done ? <CheckCircle2 size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div><strong>{label}</strong><p>{detail}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}
