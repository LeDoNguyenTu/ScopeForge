import Link from "next/link";
import { Github, Menu } from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

const communityUrl = "https://github.com/LeDoNguyenTu/ScopeForge";

export default function PublicNav() {
  return (
    <header className="forgePublicHeader">
      <nav className="forgePublicNav" aria-label="Public navigation">
        <Link className="forgePublicBrand" href="/" aria-label="ScopeForge home">
          <ScopeForgeWordmark />
        </Link>

        <div className="forgePublicLinks">
          <a href="#platform">Platform</a>
          <a href="#security-model">Security model</a>
          <a href={communityUrl} target="_blank" rel="noreferrer"><Github size={15} /> Community</a>
          <Link href="/auth/sign-in">Sign in</Link>
          <Link className="forgeNavCta" href="/auth/sign-up">Create account</Link>
        </div>

        <details className="forgeMobileMenu">
          <summary aria-label="Open navigation menu"><Menu size={18} /></summary>
          <div className="forgeMobileMenuPanel">
            <a href="#platform">Platform</a>
            <a href="#security-model">Security model</a>
            <a href={communityUrl} target="_blank" rel="noreferrer"><Github size={15} /> Community</a>
            <Link href="/auth/sign-in">Sign in</Link>
            <Link className="forgeNavCta" href="/auth/sign-up">Create account</Link>
          </div>
        </details>
      </nav>
    </header>
  );
}
