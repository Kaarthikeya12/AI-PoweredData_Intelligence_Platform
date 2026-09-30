import Link from "next/link";
import BrandMark from "@/components/ui/brand-mark";

export default function NotFound() {
  return (
    <main className="not-found" id="main">
      <Link href="/" className="brand">
        <BrandMark />
        <span>DataIntel</span>
      </Link>
      <span className="not-found-code">404</span>
      <h1>Page not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="not-found-actions">
        <Link href="/" className="btn btn-secondary">
          Back to home
        </Link>
        <Link href="/dashboard" className="btn btn-primary">
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
