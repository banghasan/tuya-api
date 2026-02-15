import { Hono } from "hono";
import {
  smartplugCurrent,
  smartplugOff,
  smartplugOn,
  smartplugStatus,
} from "../controllers/smartplug.ts";
import { irblasterCurrent, irblasterStatus } from "../controllers/irblaster.ts";
import { devicesList, devicesScan } from "../controllers/devices.ts";
import { publicConfig } from "../controllers/config.ts";
import { verifyApiKey } from "../services/config.ts";

export function registerApiRoutes(app: Hono) {
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/config") {
      await next();
      return;
    }
    if (!verifyApiKey(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  app.get("/api/config", publicConfig);
  app.get("/api/smartplug/current", smartplugCurrent);
  app.get("/api/smartplug/status", smartplugStatus);
  app.post("/api/smartplug/on", smartplugOn);
  app.get("/api/smartplug/on", smartplugOn);
  app.post("/api/smartplug/off", smartplugOff);
  app.get("/api/smartplug/off", smartplugOff);

  app.get("/api/irblaster/current", irblasterCurrent);
  app.get("/api/irblaster/status", irblasterStatus);

  app.get("/api/devices/scan", devicesScan);
  app.get("/api/devices/list", devicesList);
}
