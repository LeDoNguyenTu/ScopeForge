import Link from "next/link";
import { ArrowRight, CirclePlay } from "lucide-react";
import LandingDataIllustration from "./LandingDataIllustration";

export default function CommandCenterLandingHero() {
  return <section className="commandHero" aria-labelledby="command-hero-title">
    <div className="commandHeroGrid" aria-hidden="true" />
    <div className="commandHeroCopy">
      <span className="commandHeroEyebrow">LIVING ATTACK SURFACE</span>
      <h1 id="command-hero-title">Understand the risk before it becomes <span>an incident.</span></h1>
      <p className="commandHeroLead">Discover your attack surface, understand the evidence, and move from exposure to a verified fix. One connected view of your security work.</p>
      <div className="commandHeroActions">
        <Link className="commandHeroPrimary" href="/dashboard">Explore the platform <ArrowRight size={18} /></Link>
        <a className="commandHeroSecondary" href="#platform">See it in action <CirclePlay size={18} /></a>
      </div>
    </div>
    <LandingDataIllustration />
  </section>;
}
