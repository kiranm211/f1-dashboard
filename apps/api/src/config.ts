import "dotenv/config";

import { z } from "zod";

const schema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_TTL_LEADERBOARD_SECONDS: z.coerce.number().int().positive().default(5),
  CACHE_TTL_SESSIONS_SECONDS: z.coerce.number().int().positive().default(120),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default("f1_dashboard"),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("postgres")
});

export const config = schema.parse(process.env);
