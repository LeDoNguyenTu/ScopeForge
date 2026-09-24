import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  LockKeyhole,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { runtimeReadinessSummary } from "@/lib/provider-runtime/readiness";

export default function PublicSecurityEngine() {
  const readiness = runtimeReadinessSummary();

  return (
    <section id="engine" className="publicEngine commandBelowFold" aria-labelledby="public-engine-heading">
      <div className="publicEngineHeading">
        <div>
          <span className="forgeEyebrow"><Radar size={24} /> Automated security engine</span>
          <h2 id="public-engine-heading">From verified scope to bounded evidence.</h2>
          <p>
            ScopeForge does more than collect findings. It plans authorized security work, executes only
            through accepted runtimes, records coverage and reduces provider output into reviewable evidence.
          </p>
        </div>
        <Link href="/auth/sign-up">
          Explore the platform <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="publicEngineTruth" aria-label="Current runtime availability">
        <div>
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>Operational runtimes</span>
          <strong>{readiness.operational}</strong>
          <small>Accepted for bounded execution</small>
        </div>
        <div>
          <CircleDashed size={17} aria-hidden="true" />
          <span>External validating</span>
          <strong>{readiness.preparedExternal}</strong>
          <small>Prepared behind release gates</small>
        </div>
        <div>
          <LockKeyhole size={17} aria-hidden="true" />
          <span>External enabled</span>
          <strong>{readiness.enabledExternal}</strong>
          <small>Production external runtimes</small>
        </div>
      </div>

      <div className="publicEngineFlow" aria-label="Automated security execution flow">
        <article>
          <span>01</span>
          <ShieldCheck size={22} aria-hidden="true" />
          <h3>Authorize</h3>
          <p>Bind every run to verified workspace scope before remote execution is considered.</p>
        </article>
        <article>
          <span>02</span>
          <Radar size={22} aria-hidden="true" />
          <h3>Plan</h3>
          <p>Turn observations into bounded actions while policy rejects targets or capabilities outside authority.</p>
        </article>
        <article>
          <span>03</span>
          <CircleDashed size={22} aria-hidden="true" />
          <h3>Execute</h3>
          <p>Use accepted runtimes with server-owned network, request, resource and cancellation ceilings.</p>
        </article>
        <article>
          <span>04</span>
          <FileSearch size={22} aria-hidden="true" />
          <h3>Reduce evidence</h3>
          <p>Persist normalized observations and explicit coverage instead of handing raw provider authority to the UI.</p>
        </article>
      </div>

      <div className="publicEngineBoundary">
        <LockKeyhole size={18} aria-hidden="true" />
        <div>
          <strong>Capability is not permission.</strong>
          <p>
            The first-party HTTP runtime is operational today. ProjectDiscovery httpx and Nuclei are
            intentionally visible as validation-only and remain unavailable to production runs until their
            own containment, worker-routing and bounded canary gates pass.
          </p>
        </div>
      </div>
    </section>
  );
}
