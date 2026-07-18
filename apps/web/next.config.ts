import type { NextConfig } from "next";

const config: NextConfig = {
  // Ship a minimal server bundle for the Railway Docker image.
  output: "standalone",
  // Consume the shared TS packages as source (types + the Remotion caption components,
  // which power the live <Player> caption preview).
  transpilePackages: [
    "@sentezy/types",
    "@sentezy/remotion",
    "remotion",
    "@remotion/player",
    "@remotion/transitions",
  ],
};

export default config;
