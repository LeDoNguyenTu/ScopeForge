import Link from "next/link";
import { ArrowDownToLine, ArrowRight, BookOpen, FileCheck2, ShieldCheck } from "lucide-react";

const templates = [
  { title: "Asset readiness checklist", copy: "Record ownership, define the target, and prepare proof of control before registering an asset.", href: "/resources/asset-readiness.md", Icon: ShieldCheck, label: "Scope & ownership" },
  { title: "Finding review worksheet", copy: "Keep evidence, impact, remediation, and fresh verification together in one reviewable record.", href: "/resources/finding-review.md", Icon: FileCheck2, label: "Evidence & remediation" },
];
const guides = [
  { title: "Target verification", copy: "Understand domain controls and the boundary for remote testing.", path: "docs/DOMAIN_SECURITY.md" },
  { title: "Validation methodology", copy: "Read how security claims are evaluated against evidence.", path: "docs/validation/METHODOLOGY.md" },
  { title: "Project documentation", copy: "Explore architecture, operations, and product decisions.", path: "docs/README.md" },
];

export function DashboardResources() {
  return (
    <section className="dashboardResources" aria-label="Workspace resources">
      <div><BookOpen size={20} /><span><strong>A clearer next step</strong><small>Checklists and guides for your security workflow.</small></span></div>
      <Link href="/dashboard/resources">Browse resources <ArrowRight size={15} /></Link>
      <a href="/resources/finding-review.md" download>Finding worksheet <ArrowDownToLine size={15} /></a>
    </section>
  );
}

export default function ResourceLibrary({ workspace = false }: { workspace?: boolean }) {
  return (
    <div className="resourceLibrary">
      <section className="resourceIntro">
        <span className="forgeEyebrow"><BookOpen size={14} /> Resource library</span>
        <h1>From scope to proof.</h1>
        <p>Practical templates and project documentation to help you register assets, review findings, and verify the fix.</p>
        <Link className="resourcePrimary" href={workspace ? "/dashboard/assets/new" : "/dashboard"}>{workspace ? "Register an asset" : "Explore the demo"} <ArrowRight size={16} /></Link>
      </section>
      <section aria-labelledby="resource-templates">
        <div className="resourceSectionHeading"><h2 id="resource-templates">Ready-to-use templates</h2><span>Markdown · Free to download</span></div>
        <div className="resourceTemplateGrid">
          {templates.map(({ title, copy, href, Icon, label }) => (
            <a className="resourceTemplate" href={href} download key={href}>
              <div className="resourceCardTop"><Icon size={23} /><span>{label}</span></div>
              <h3>{title}</h3><p>{copy}</p>
              <span className="resourceCardAction">Download template <ArrowDownToLine size={16} /></span>
            </a>
          ))}
        </div>
      </section>
      <section aria-labelledby="resource-guides">
        <div className="resourceSectionHeading"><h2 id="resource-guides">Understand the workflow</h2><span>Project guides</span></div>
        <div className="resourceGuideGrid">
          {guides.map(({ title, copy, path }, index) => (
            <a className="resourceGuide" key={path} href={`https://github.com/LeDoNguyenTu/ScopeForge/blob/main/${path}`} target="_blank" rel="noreferrer">
              <span className="resourceGuideNumber">0{index + 1}</span><h3>{title}</h3><p>{copy}</p><span className="resourceCardAction">Read on GitHub <ArrowRight size={15} /></span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
