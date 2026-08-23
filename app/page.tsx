import Link from "next/link";
import { ArrowRight, BookOpenCheck, Boxes, Github, Network, ShieldCheck, Sparkles } from "lucide-react";

const capabilities = [
  [Boxes, "Discover", "Start with an explicit inventory of the applications, APIs and repositories your workspace is responsible for."],
  [ShieldCheck, "Validate", "Prove control before remote testing. ScopeForge keeps authorization and scanner execution as separate security boundaries."],
  [Network, "Explain and connect", "The roadmap turns technical evidence into understandable Security Stories that distinguish observed facts from inferred consequences."],
  [BookOpenCheck, "Prepare and verify", "Remediation, preparedness guidance and retesting are designed to close the loop instead of stopping at an alert."]
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
          <a href="#platform">Mission</a>
          <a href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer"><Github size={15} /> Community</a>
          <Link className="secondaryButton compact" href="/auth/sign-in">Sign in</Link>
          <Link className="primaryButton compact" href="/auth/sign-up">Create account</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow"><Sparkles size={15} /> Open-source application security</div>
          <h1>Understand the risk before it becomes an incident.</h1>
          <p>ScopeForge is being built to help developers discover security weaknesses, understand what they could realistically lead to, prepare for the consequences, fix the root cause and verify that the risk is gone.</p>
          <div className="heroActions">
            <Link className="primaryButton" href="/auth/sign-up">Start a workspace <ArrowRight size={16} /></Link>
            <a className="secondaryButton" href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer"><Github size={16} /> Explore the project</a>
          </div>
          <p className="heroNote">Community-built. Evidence-first. For systems you own or are explicitly authorized to assess.</p>
        </div>

        <div className="heroPanel" aria-label="ScopeForge product workflow">
          <div className="panelChrome"><span>scopeforge / mission</span><span className="pulse"><i /> phase 2</span></div>
          <div className="scoreBlock missionBlock">
            <div><span className="scoreLabel">Core workflow</span><strong className="missionTitle">Know what could happen next.</strong><span className="scoreDelta">Then prepare, fix and verify.</span></div>
            <div className="scoreRing"><span>7 steps</span></div>
          </div>
          <div className="previewRows">
            <div><span><i className="severity ok" /> Discover {"->"} Validate</span><strong>Scope first</strong></div>
            <div><span><i className="severity low" /> Explain {"->"} Connect</span><strong>Context</strong></div>
            <div><span><i className="severity medium" /> Prepare {"->"} Fix</span><strong>Action</strong></div>
            <div><span><i className="severity ok" /> Verify</span><strong>Close the loop</strong></div>
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
