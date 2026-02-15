// Web API untuk smartplug dengan Deno + Hono
import { Hono } from "hono";
import { load as loadEnv } from "std/dotenv";
import { registerRoutes } from "./routes/index.ts";
import {
  resetTuyaFactoryForTest,
  setTuyaFactoryForTest,
} from "./services/tuya.ts";

// Muat .env dari root project (relative ke file ini)
const envPath = new URL("../.env", import.meta.url).pathname;
await loadEnv({ export: true, envPath });

export function buildApp() {
  const app = new Hono();
  registerRoutes(app);
  return app;
}

export { resetTuyaFactoryForTest, setTuyaFactoryForTest };

export const api = buildApp();

if (import.meta.main) {
  Deno.serve(api.fetch);
}
