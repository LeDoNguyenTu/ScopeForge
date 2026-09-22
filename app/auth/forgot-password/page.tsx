import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Recover account" };

export default function ForgotPasswordPage() {
  return <main className="authPage"><ForgotPasswordForm /></main>;
}
