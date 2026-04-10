import { buildApp } from "./app.js";
import { config } from "./config.js";

async function main() {
  const app = buildApp();

  await app.listen({
    host: config.API_HOST,
    port: config.API_PORT
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
