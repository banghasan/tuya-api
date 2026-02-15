import { Hono } from "hono";
import { dashboardHandler } from "../controllers/dashboard.ts";

export function registerPageRoutes(app: Hono) {
  app.get("/", (c) => c.text("Tuya API: OK"));
  app.get("/smartplug", dashboardHandler);
}
