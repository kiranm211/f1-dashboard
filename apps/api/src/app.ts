import Fastify from "fastify";

import { adminSyncRoutes } from "./routes/admin-sync.js";
import { closeCache } from "./cache.js";
import { circuitRoutes } from "./routes/circuits.js";
import { driverRoutes } from "./routes/drivers.js";
import { healthRoutes } from "./routes/health.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { raceCalendarRoutes } from "./routes/race-calendar.js";
import { raceAnalysisRoutes } from "./routes/race-analysis.js";
import { replayRoutes } from "./routes/replay.js";
import { sessionInsightsRoutes } from "./routes/session-insights.js";
import { sessionRoutes } from "./routes/sessions.js";
import { standingsRoutes } from "./routes/standings.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.register(healthRoutes);
  app.register(circuitRoutes);
  app.register(driverRoutes);
  app.register(adminSyncRoutes);
  app.register(raceAnalysisRoutes);
  app.register(raceCalendarRoutes);
  app.register(sessionRoutes);
  app.register(sessionInsightsRoutes);
  app.register(leaderboardRoutes);
  app.register(replayRoutes);
  app.register(standingsRoutes);
  app.addHook("onClose", async () => {
    await closeCache();
  });

  return app;
}
