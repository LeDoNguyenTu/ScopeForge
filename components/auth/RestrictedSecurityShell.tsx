import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

export default function RestrictedSecurityShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="restrictedSecurityShell">
      <header className="restrictedSecurityHeader">
        <Link href="/" aria-label="ScopeForge home"><ScopeForgeWordmark /></Link>
        <form action={signOut}><button type="submit" className="secondaryButton"><LogOut aria-hidden="true" size={15} /> Sign out</button></form>
      </header>
      <main className="restrictedSecurityContent">
        <p className="restrictedSecurityNotice" role="status"><strong>Two-step verification is required for platform administrators.</strong> Finish authenticator enrollment to continue. Your dashboard will open automatically after verification.</p>
        {children}
      </main>
    </div>
  );
}
