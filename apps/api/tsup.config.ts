import { defineConfig } from "tsup";

// Bundle the workspace (@sentezy/*) source into the output; keep npm deps external
// (shipped via node_modules on Railway). @prisma/client stays external — it carries
// its own query-engine binary.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  sourcemap: true,
  noExternal: [/^@sentezy\//],
});
