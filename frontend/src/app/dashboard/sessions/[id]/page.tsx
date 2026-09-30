import type { Metadata } from "next";
import SessionDetail from "@/components/dashboard/session-detail";

export const metadata: Metadata = { title: "Session — DataIntel" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionDetail sessionId={id} />;
}
