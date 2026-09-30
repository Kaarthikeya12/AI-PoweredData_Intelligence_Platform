import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root also has a package-lock.json; pin the workspace to frontend/.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
