import type { Metadata } from "next";
import AuthCard from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Sign in — DataIntel" };

type SearchParams = Promise<{ next?: string | string[]; error?: string | string[] }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <AuthCard mode="login" next={first(params.next)} errorCode={first(params.error)} />;
}
