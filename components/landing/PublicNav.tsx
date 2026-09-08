"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Github, Menu } from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

export default function PublicNav() {
  const pathname = usePathname();
  return (
    <header className="forgePublicHeader commandPublicHeader">
      <nav className="forgePublicNav commandPublicNav" aria-label="Public navigation">
        <Link className="forgePublicBrand commandPublicBrand" href="/" aria-label="ScopeForge home">
          <ScopeForgeWordmark />
        </Link>

        <div className="forgePublicLinks commandPublicLinks">
          <Link href="/#platform">Product</Link>
          <Link href="/#security-model">Security</Link>
          <Link href="/resources" aria-current={pathname === "/resources" ? "page" : undefined}>Resources</Link>
          <a href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer"><Github size={14} /> GitHub</a>
        </div>

        <div className="commandPublicAuth">
          <Link href="/auth/sign-in">Sign in</Link>
          <Link className="commandRequestAccess" href="/auth/sign-up">Create workspace <ArrowRight size={14} /></Link>
        </div>

        <details
          className="forgeMobileMenu commandMobileMenu"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="Open navigation menu"><Menu size={20} /></summary>
          <div className="forgeMobileMenuPanel commandMobileMenuPanel">
            <Link href="/#platform">Product</Link>
            <Link href="/#security-model">Security</Link>
            <Link href="/resources" aria-current={pathname === "/resources" ? "page" : undefined}>Resources</Link>
            <a href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer">GitHub</a>
            <Link href="/auth/sign-in">Sign in</Link>
            <Link className="commandRequestAccess" href="/auth/sign-up">Create workspace <ArrowRight size={14} /></Link>
          </div>
        </details>
      </nav>
    </header>
  );
}
