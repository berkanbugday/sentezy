import type { NextConfig } from "next";

const config: NextConfig = {
  // Ship a minimal server bundle for the Railway Docker image.
  output: "standalone",
  // Consume the shared TS contracts package as source.
  transpilePackages: ["@sentezy/types"],
};

export default config;
