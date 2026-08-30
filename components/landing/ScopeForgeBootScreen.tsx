import ScopeForgeMark from "@/components/brand/ScopeForgeMark";

export default function ScopeForgeBootScreen({ progress, stage }: { progress: number; stage: string }) {
  const boundedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="scopeForgeBoot" role="status" aria-live="polite" aria-label="ScopeForge initialization">
      <div className="scopeForgeBootBackdrop" aria-hidden="true" />
      <div className="scopeForgeBootCard">
        <div className="scopeForgeBootMark" aria-hidden="true">
          <span className="scopeForgeBootOrbit" />
          <ScopeForgeMark size={58} decorative />
        </div>
        <p className="scopeForgeBootGreeting">Welcome to ScopeForge</p>
        <h1>Preparing living attack surface</h1>
        <div className="scopeForgeBootProgressRow">
          <output>{boundedProgress}%</output>
          <span>{stage}</span>
        </div>
        <div
          className="scopeForgeBootTrack"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={boundedProgress}
          aria-label="Attack surface initialization progress"
        >
          <span style={{ width: `${boundedProgress}%` }} />
        </div>
        <p className="scopeForgeBootNote">Authorized security workspace initialization</p>
      </div>
    </div>
  );
}
