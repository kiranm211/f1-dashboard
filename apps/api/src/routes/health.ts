import type { FastifyPluginAsync } from "fastify";

import { healthcheckDatabase } from "../db.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    await healthcheckDatabase();

    return {
      status: "ok",
      service: "f1-dashboard-api"
    };
  });
};
