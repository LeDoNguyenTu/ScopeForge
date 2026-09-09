import type { Metadata } from "next";
import { headers } from "next/headers";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  const nonce = (await headers()).get("x-nonce");
  return <main className="authPage"><AuthForm mode="sign-up" nonce={nonce} /></main>;
}
