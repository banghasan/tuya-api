import { Hono } from "hono";
import { dashboardHandler } from "../controllers/dashboard.ts";
import {
  dashboardCss,
  dashboardFavicon,
  dashboardFavicon16,
  dashboardFavicon32,
  dashboardFaviconIco,
  dashboardJs,
  dashboardAppleTouch,
} from "../controllers/assets.ts";
import { getVersion } from "../version.ts";

export function registerPageRoutes(app: Hono) {
  app.get("/", async (c) => {
    const version = await getVersion();
    return c.json({ status: "ok", version });
  });
  app.get("/favicon.ico", () => dashboardFaviconIco());
  app.get("/smartplug", dashboardHandler);
  app.get("/assets/dashboard.css", () => dashboardCss());
  app.get("/assets/dashboard.js", () => dashboardJs());
  app.get("/assets/favicon.svg", () => dashboardFavicon());
  app.get("/assets/favicon-16.png", () => dashboardFavicon16());
  app.get("/assets/favicon-32.png", () => dashboardFavicon32());
  app.get("/assets/apple-touch-icon.png", () => dashboardAppleTouch());
  app.get("/assets/favicon.ico", () => dashboardFaviconIco());
}
