import Link from "next/link";
import { ArrowRight, Github, Menu } from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

const githubUrl = "https://github.com/LeDoNguyenTu/ScopeForge";

export default function PublicNav() {
  return (
    <header className="forgePublicHeader commandPublicHeader">
      <nav className="forgePublicNav commandPublicNav" aria-label="Public navigation">
        <Link className="forgePublicBrand commandPublicBrand" href="/" aria-label="ScopeForge home">
          <ScopeForgeWordmark />
        </Link>

        <div className="forgePublicLinks commandPublicLinks">
          <a href="#platform">Product</a>
          <a href="#security-model">Security model</a>
          <a href={githubUrl} target="_blank" rel="noreferrer"><Github size={14} /> GitHub</a>
        </div>

        <div className="commandPublicAuth">
          <Link href="/auth/sign-in">Sign in</Link>
          <Link className="commandRequestAccess" href="/auth/sign-up">Create workspace <ArrowRight size={14} /></Link>
        </div>

        <details className="forgeMobileMenu commandMobileMenu">
          <summary aria-label="Open navigation menu"><Menu size={20} /></summary>
          <div className="forgeMobileMenuPanel commandMobileMenuPanel">
            <a href="#platform">Product</a>
            <a href="#security-model">Security model</a>
            <a href={githubUrl} target="_blank" rel="noreferrer"><Github size={15} /> GitHub</a>
            <Link href="/auth/sign-in">Sign in</Link>
            <Link className="commandRequestAccess" href="/auth/sign-up">Create workspace <ArrowRight size={14} /></Link>
          </div>
        </details>
      </nav>
    </header>
  );
}
