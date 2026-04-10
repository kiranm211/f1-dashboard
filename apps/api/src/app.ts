import Fastify from "fastify";

import { closeCache } from "./cache.js";
import { healthRoutes } from "./routes/health.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { sessionRoutes } from "./routes/sessions.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.register(healthRoutes);
  app.register(sessionRoutes);
  app.register(leaderboardRoutes);
  app.addHook("onClose", async () => {
    await closeCache();
  });

  return app;
}
