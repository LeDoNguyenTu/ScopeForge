import type { Metadata } from "next";
import { headers } from "next/headers";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const nonce = (await headers()).get("x-nonce");
  return <main className="authPage"><AuthForm mode="sign-in" nonce={nonce} /></main>;
}
