import Link from "next/link";
import { ArrowRight, Binary, Boxes, Github, Radar, ShieldCheck, Sparkles } from "lucide-react";

const capabilities = [
  [Radar, "Runtime testing", "Authorized web and API assessment with bounded, non-destructive scan profiles."],
  [Binary, "Code security", "A transparent scanner pipeline for SAST, secrets, dependencies and infrastructure-as-code."],
  [Boxes, "Unified findings", "Normalize evidence, CWE, CVSS, confidence and remediation into one workspace."],
  [ShieldCheck, "Security by design", "Strong tenancy boundaries, target verification, auditability and abuse controls from the foundation."]
] as const;

export default function Home() {
  return (
    <main className="landing">
      <nav className="siteNav">
        <Link href="/" className="brand" aria-label="ScopeForge home">
          <span className="brandMark"><ShieldCheck size={18} /></span>
          <span>ScopeForge</span>
        </Link>
        <div className="navLinks">
          <a href="#platform">Platform</a>
          <a href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer"><Github size={15} /> Source</a>
          <Link className="secondaryButton compact" href="/auth/sign-in">Sign in</Link>
          <Link className="primaryButton compact" href="/auth/sign-up">Create account</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow"><Sparkles size={15} /> Authorized application security</div>
          <h1>See your attack surface. Prove what matters.</h1>
          <p>ScopeForge brings code security, safe runtime assessment and evidence-first vulnerability management into one focused workspace for developers and security practitioners.</p>
          <div className="heroActions">
            <Link className="primaryButton" href="/auth/sign-up">Start a workspace <ArrowRight size={16} /></Link>
            <Link className="secondaryButton" href="/dashboard">View dashboard</Link>
          </div>
          <p className="heroNote">Open source. Built for systems you own, labs and explicitly authorized assessments.</p>
        </div>

        <div className="heroPanel" aria-label="ScopeForge security posture preview">
          <div className="panelChrome"><span>scopeforge / posture</span><span className="pulse"><i /> live model</span></div>
          <div className="scoreBlock">
            <div><span className="scoreLabel">Security score</span><strong>86</strong><span className="scoreDelta">+7 after remediation</span></div>
            <div className="scoreRing"><span>86%</span></div>
          </div>
          <div className="previewRows">
            <div><span><i className="severity high" /> Dependency exposure</span><strong>2 high</strong></div>
            <div><span><i className="severity medium" /> Runtime hardening</span><strong>4 medium</strong></div>
            <div><span><i className="severity low" /> Information exposure</span><strong>3 low</strong></div>
            <div><span><i className="severity ok" /> Ownership coverage</span><strong>100%</strong></div>
          </div>
        </div>
      </section>

      <section id="platform" className="featureGrid">
        {capabilities.map(([Icon, title, copy]) => (
          <article className="featureCard" key={title}>
            <div className="featureIcon"><Icon size={19} /></div>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
