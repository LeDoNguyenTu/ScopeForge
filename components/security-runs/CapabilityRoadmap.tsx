import { ArrowRight, CircleDashed, LockKeyhole } from "lucide-react";
import { PHASE12_RUNTIME_ROADMAP } from "@/lib/provider-runtime/readiness";
import styles from "@/app/dashboard/security-runs/security-runs.module.css";

export default function CapabilityRoadmap() {
  return (
    <section className={styles.panel} aria-labelledby="capability-roadmap-heading">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelKicker}>Phase 12 expansion</span>
          <h2 id="capability-roadmap-heading">Automated pentest capability roadmap</h2>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
      </div>
      <p className={styles.sectionIntro}>
        ScopeForge expands capability by capability. A feature appears as runnable only after its own authorization,
        containment, worker and production acceptance gates pass.
      </p>
      <div className={styles.roadmapGrid}>
        {PHASE12_RUNTIME_ROADMAP.map((item) => (
          <article className={styles.roadmapCard} key={item.slice}>
            <div className={styles.roadmapTop}>
              <span className={styles.roadmapSlice}>{item.slice}</span>
              <span className={item.state === "validation" ? `${styles.status} ${styles.statusWarn}` : styles.status}>
                {item.state === "validation" ? <CircleDashed size={11} aria-hidden="true" /> : <LockKeyhole size={11} aria-hidden="true" />}
                {item.state === "validation" ? "Validation" : "Planned"}
              </span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
