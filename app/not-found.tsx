import Link from "next/link";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

export default function NotFound() {
  return (
    <main className="scopeForgeNotFound">
      <section className="scopeForgeNotFoundCard" aria-labelledby="scopeforge-not-found-title">
        <Link className="scopeForgeNotFoundBrand" href="/" aria-label="ScopeForge home">
          <ScopeForgeWordmark />
        </Link>
        <p className="scopeForgeNotFoundCode">404 - NOT FOUND</p>
        <h1 id="scopeforge-not-found-title">This route is outside the mapped surface.</h1>
        <p className="scopeForgeNotFoundCopy">
          The page may have moved, expired, or never existed. Return to ScopeForge and continue from a known route.
        </p>
        <Link className="primaryButton scopeForgeNotFoundAction" href="/">
          Return to ScopeForge
        </Link>
      </section>
    </main>
  );
}
