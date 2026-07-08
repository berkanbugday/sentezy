import cors from "@fastify/cors";
import Fastify from "fastify";
import authPlugin from "./plugins/auth";
import { backgroundRoutes } from "./routes/backgrounds";
import { healthRoutes } from "./routes/health";
import { presenterRoutes } from "./routes/presenters";
import { videoRoutes } from "./routes/videos";
import { voiceRoutes } from "./routes/voices";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });
  app.register(authPlugin); // decorates app.authenticate (must precede protected routes)

  app.register(healthRoutes);
  app.register(voiceRoutes);
  app.register(backgroundRoutes);
  app.register(presenterRoutes);
  app.register(videoRoutes);

  return app;
}
