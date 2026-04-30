import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo uses workspace-style nested package-lock.json files (root, functions,
  // parent-portal). Without this, Next.js infers the wrong workspace root and
  // emits a build-time warning. Pinning to the parent-portal directory keeps
  // file-tracing scoped to this project.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
