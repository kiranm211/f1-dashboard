import { sql } from "drizzle-orm";

import { db } from "./db/client.js";

export async function healthcheckDatabase(): Promise<void> {
  await db.execute(sql`select 1`);
}
