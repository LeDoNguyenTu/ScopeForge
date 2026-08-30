import {
  BookOpenCheck,
  Boxes,
  Bug,
  CircleCheck,
  GitBranch,
  Network,
  ScanSearch,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import CommandCenterLandingHero from "@/components/landing/CommandCenterLandingHero";
import LandingBootGate from "@/components/landing/LandingBootGate";
import PublicNav from "@/components/landing/PublicNav";

const workflow = [
  [Boxes, "Discover", "Inventory the applications, APIs, repositories and services that belong to your workspace."],
  [ShieldCheck, "Validate", "Prove control before remote testing and keep authorization separate from execution authority."],
  [ScanSearch, "Explain", "Turn deterministic evidence into context that a developer can understand and review."],
  [GitBranch, "Connect", "Relate evidence and consequences without presenting inference as observed fact."],
  [BookOpenCheck, "Prepare", "Make the likely consequences and response steps visible before an incident happens."],
  [Wrench, "Fix", "Keep remediation work attached to the finding, its evidence and its ownership history."],
  [CircleCheck, "Verify", "Retest with fresh evidence and close the loop only when the risk is actually gone."],
] as const;

export default function Home() {
  return (
    <main className="forgeLanding commandLanding">
      <LandingBootGate>
        <PublicNav />
        <CommandCenterLandingHero />
      </LandingBootGate>

      <section id="platform" className="forgePlatform commandBelowFold">
        <div className="forgeSectionHeading">
          <span className="forgeEyebrow"><Network size={14} /> One evidence-first workflow</span>
          <h2>Security work should end with proof, not another alert.</h2>
          <p>ScopeForge keeps scope, evidence, explanation, remediation and verification connected while preserving the authority boundaries between them.</p>
        </div>
        <div className="forgeWorkflowGrid">
          {workflow.map(([Icon, title, copy], index) => (
            <article className="forgeWorkflowCard" key={title}>
              <div className="forgeWorkflowTop"><span>{String(index + 1).padStart(2, "0")}</span><Icon size={17} /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="security-model" className="forgeSecurityModel commandBelowFold">
        <div className="forgeSecurityIntro">
          <span className="forgeEyebrow"><ShieldCheck size={14} /> Security model</span>
          <h2>Authority stays narrower than capability.</h2>
          <p>ScopeForge is designed so a powerful scanner does not automatically become permission to scan anything. Remote behavior stays attached to verified targets, closed request shapes and explicit authorization.</p>
          <a href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer">Read the open-source project</a>
        </div>
        <div className="forgeSecurityCards">
          <article><ShieldCheck size={18} /><strong>Scope first</strong><p>Workspace assets and proof of control establish the boundary before remote security workflows can run.</p></article>
          <article><Bug size={18} /><strong>Evidence first</strong><p>Findings remain attributable to deterministic scanner or runtime evidence rather than unexplained model inference.</p></article>
          <article><CircleCheck size={18} /><strong>Verify the fix</strong><p>Remediation closes only through fresh trusted evidence and a reviewable lifecycle, not a status toggle alone.</p></article>
        </div>
      </section>
    </main>
  );
}
