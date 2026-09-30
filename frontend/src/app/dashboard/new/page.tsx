import type { Metadata } from "next";
import NewCollection from "@/components/dashboard/new-collection";

export const metadata: Metadata = { title: "New collection — DataIntel" };

export default function NewCollectionPage() {
  return <NewCollection />;
}
