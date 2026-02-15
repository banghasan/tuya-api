import { Hono } from "hono";
import { registerApiRoutes } from "./api.ts";
import { registerHealthRoutes } from "./health.ts";
import { registerPageRoutes } from "./pages.ts";

export function registerRoutes(app: Hono) {
  registerHealthRoutes(app);
  registerPageRoutes(app);
  registerApiRoutes(app);
}
