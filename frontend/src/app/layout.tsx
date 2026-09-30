import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataIntel — AI-Powered Data Intelligence",
  description:
    "Turn natural-language data requests into structured, source-backed datasets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}