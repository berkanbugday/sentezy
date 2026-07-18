import { Config } from "@remotion/cli/config";

// PNG frames preserve the alpha channel between frames so the caption overlay renders
// transparent (composited over the reel by the worker). Alpha is emitted when rendering
// with `--codec=prores --prores-profile=4444` (the Cloudflare container does this).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
