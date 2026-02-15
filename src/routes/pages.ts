import { Hono } from "hono";
import { dashboardHandler } from "../controllers/dashboard.ts";
import { dashboardCss, dashboardJs } from "../controllers/assets.ts";

export function registerPageRoutes(app: Hono) {
  app.get("/", (c) => c.text("Tuya API: OK"));
  app.get("/smartplug", dashboardHandler);
  app.get("/assets/dashboard.css", () => dashboardCss());
  app.get("/assets/dashboard.js", () => dashboardJs());
}
