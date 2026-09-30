import type { Metadata } from "next";
import History from "@/components/dashboard/history";

export const metadata: Metadata = { title: "History — DataIntel" };

export default function HistoryPage() {
  return <History />;
}
