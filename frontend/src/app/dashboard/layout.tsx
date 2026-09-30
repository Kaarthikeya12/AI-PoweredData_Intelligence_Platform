import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { getCurrentUser } from "@/lib/supabase/server";
import "@/components/dashboard/dashboard.css";

export const metadata: Metadata = { title: "Dashboard — DataIntel" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The proxy already redirects signed-out users; this is defence in depth.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  return (
    <DashboardShell user={{ email: user.email, name: user.name, avatarUrl: user.avatarUrl }}>
      {children}
    </DashboardShell>
  );
}
