import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage() { return <main className="authPage"><AuthForm mode="sign-in" /></main>; }
