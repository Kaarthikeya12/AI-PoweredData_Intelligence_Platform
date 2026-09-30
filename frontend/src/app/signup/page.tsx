import type { Metadata } from "next";
import AuthCard from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Create account — DataIntel" };

type SearchParams = Promise<{ next?: string | string[] }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <AuthCard mode="signup" next={first(params.next)} />;
}
