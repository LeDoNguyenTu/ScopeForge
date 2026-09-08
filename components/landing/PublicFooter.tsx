import Link from "next/link";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

export default function PublicFooter() {
  return (
    <footer className="publicFooter">
      <div className="publicFooterBrand">
        <Link href="/" aria-label="ScopeForge home"><ScopeForgeWordmark compact /></Link>
        <p>© {new Date().getFullYear()} Brian Le. ScopeForge is open source under the MIT License.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/resources">Resources</Link>
        <Link href="/#security-model">Security model</Link>
        <a href="https://github.com/LeDoNguyenTu/ScopeForge" target="_blank" rel="noreferrer">GitHub</a>
        <a href="https://github.com/LeDoNguyenTu/ScopeForge/blob/main/LICENSE" target="_blank" rel="noreferrer">License</a>
      </nav>
    </footer>
  );
}
