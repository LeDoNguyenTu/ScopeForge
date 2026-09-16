import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, Mail, TriangleAlert } from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

export type AuthResultStatus = "sent" | "success" | "expired" | "invalid" | "error";

const messages = {
  sent: { title: "Check your email", detail: "Open the confirmation link in your email to continue. Check your spam folder too. If you already have an account, you can sign in." },
  success: { title: "Email confirmed", detail: "Your email is confirmed. Continue to your workspace." },
  expired: { title: "This link has expired or was already used", detail: "If you already confirmed your email, sign in. Otherwise, return to signup to request a new confirmation email." },
  invalid: { title: "We could not confirm this link", detail: "The confirmation link is incomplete or invalid. Open the full link from your email, or return to signup." },
  error: { title: "Confirmation is temporarily unavailable", detail: "Please try the link again shortly. If your email is already confirmed, you can sign in." }
};

export default function AuthStatusCard({ status, onTryAgain }: { status: AuthResultStatus; onTryAgain?: () => void }) {
  const message = messages[status];
  const Icon = status === "sent" ? Mail : status === "success" ? CircleCheck : TriangleAlert;
  return (
    <section className="authCard" aria-labelledby="auth-result-title">
      <Link className="authBrand" href="/" aria-label="ScopeForge home"><ScopeForgeWordmark /></Link>
      <div className="authHeading" role="status" aria-live="polite">
        <span className="authIcon"><Icon size={18} /></span>
        <h1 id="auth-result-title">{message.title}</h1>
        <p>{message.detail}</p>
      </div>
      <Link className="primaryButton authSubmit" href={status === "success" ? "/dashboard" : "/auth/sign-in"}>
        {status === "success" ? "Continue to workspace" : "Sign in"}<ArrowRight size={16} />
      </Link>
      <p className="authSwitch">
        {onTryAgain ? <button className="authRetryButton" type="button" onClick={onTryAgain}>Use a different email</button> : status !== "success" && <Link href="/auth/sign-up">Return to signup</Link>}
      </p>
      <Link className="authBackLink" href="/"><ArrowLeft size={14} /> Back to ScopeForge</Link>
    </section>
  );
}
