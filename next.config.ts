import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't let `next dev` append its agent-rules block to our authored CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
