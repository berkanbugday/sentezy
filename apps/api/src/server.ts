import cors from "@fastify/cors";
import Fastify from "fastify";
import authPlugin from "./plugins/auth";
import { backgroundRoutes } from "./routes/backgrounds";
import { brandKitRoutes } from "./routes/brandKit";
import { healthRoutes } from "./routes/health";
import { importRoutes } from "./routes/import";
import { musicRoutes } from "./routes/music";
import { profileRoutes } from "./routes/profile";
import { avatarRoutes } from "./routes/avatars";
import { videoRoutes } from "./routes/videos";
import { voiceRoutes } from "./routes/voices";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });
  app.register(authPlugin); // decorates app.authenticate (must precede protected routes)

  app.register(healthRoutes);
  app.register(voiceRoutes);
  app.register(backgroundRoutes);
  app.register(brandKitRoutes);
  app.register(musicRoutes);
  app.register(profileRoutes);
  app.register(avatarRoutes);
  app.register(videoRoutes);
  app.register(importRoutes);

  return app;
}
