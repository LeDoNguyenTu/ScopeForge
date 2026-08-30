import Link from "next/link";
import { ArrowRight, ChevronDown, Menu } from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

export default function PublicNav() {
  return (
    <header className="forgePublicHeader commandPublicHeader">
      <nav className="forgePublicNav commandPublicNav" aria-label="Public navigation">
        <Link className="forgePublicBrand commandPublicBrand" href="/" aria-label="ScopeForge home">
          <ScopeForgeWordmark />
        </Link>

        <div className="forgePublicLinks commandPublicLinks">
          <a href="#platform">Platform <ChevronDown size={12} /></a>
          <a href="#platform">Use Cases <ChevronDown size={12} /></a>
          <a href="#security-model">Resources <ChevronDown size={12} /></a>
          <a href="#platform">Pricing</a>
          <a href="#security-model">Company <ChevronDown size={12} /></a>
        </div>

        <div className="commandPublicAuth">
          <Link href="/auth/sign-in">Sign in</Link>
          <Link className="commandRequestAccess" href="/auth/sign-up">Request access <ArrowRight size={14} /></Link>
        </div>

        <details className="forgeMobileMenu commandMobileMenu">
          <summary aria-label="Open navigation menu"><Menu size={20} /></summary>
          <div className="forgeMobileMenuPanel commandMobileMenuPanel">
            <a href="#platform">Platform</a>
            <a href="#platform">Use Cases</a>
            <a href="#security-model">Resources</a>
            <a href="#platform">Pricing</a>
            <a href="#security-model">Company</a>
            <Link href="/auth/sign-in">Sign in</Link>
            <Link className="commandRequestAccess" href="/auth/sign-up">Request access <ArrowRight size={14} /></Link>
          </div>
        </details>
      </nav>
    </header>
  );
}
