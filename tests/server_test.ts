import { assertEquals, assertStringIncludes } from "std/assert";
import {
  buildApp,
  resetTuyaFactoryForTest,
  setTuyaFactoryForTest,
} from "../src/server.ts";

function setEnv() {
  Deno.env.set("TUYA_SMARTPLUG_ID", "spid");
  Deno.env.set("TUYA_SMARTPLUG_KEY", "spkey");
  Deno.env.set("TUYA_SMARTPLUG_IP", "192.168.0.10");
  Deno.env.set("TUYA_SMARTPLUG_VERSION", "3.3");
  Deno.env.set("TUYA_IRBLASTER_ID", "irid");
  Deno.env.set("TUYA_IRBLASTER_KEY", "irkey");
  Deno.env.set("TUYA_IRBLASTER_IP", "192.168.0.11");
  Deno.env.set("TUYA_IRBLASTER_VERSION", "3.1");
  Deno.env.set("TUYA_API_KEY", "testkey");
}

function apiHeaders() {
  return { "x-api-key": "testkey" };
}

Deno.test("/api/devices/list returns configured devices", async () => {
  setEnv();
  const app = buildApp();

  const res = await app.request("http://localhost/api/devices/list", {
    headers: apiHeaders(),
  });
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.devices.length, 2);
  assertEquals(body.devices[0].name, "smartplug");
  assertEquals(body.devices[0].ip, "192.168.0.10");
  assertEquals(body.devices[1].name, "irblaster");
  assertEquals(body.devices[1].ip, "192.168.0.11");
});

Deno.test("/api/devices/list fails when env missing", async () => {
  Deno.env.delete("TUYA_SMARTPLUG_ID");
  const app = buildApp();

  const res = await app.request("http://localhost/api/devices/list", {
    headers: apiHeaders(),
  });
  assertEquals(res.status, 500);

  const body = await res.json();
  assertStringIncludes(body.error, "Missing env");
});

Deno.test("/api/devices/scan returns scanned devices", async () => {
  setTuyaFactoryForTest((options) => {
    const version = String(options.version ?? "");
    return {
      find: (_opts?: unknown) =>
        Promise.resolve().then(() => {
          if (version === "3.1") return [{ id: "dev1", ip: "1.1.1.1" }];
          if (version === "3.3") {
            return [
              { id: "dev2", ip: "2.2.2.2" },
              { id: "dev1", ip: "1.1.1.1" },
            ];
          }
          return [];
        }),
      connect: async () => {},
      get: () => Promise.resolve({}),
      set: () => Promise.resolve({}),
      disconnect: () => {},
    };
  });

  const app = buildApp();
  const res = await app.request(
    "http://localhost/api/devices/scan?timeout=1&versions=3.1,3.3",
    { headers: apiHeaders() },
  );
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.devices.length, 2);
  assertEquals(body.versions, ["3.1", "3.3"]);

  resetTuyaFactoryForTest();
});

Deno.test("/api endpoint returns 401 when api key missing", async () => {
  setEnv();
  const app = buildApp();

  const res = await app.request("http://localhost/api/devices/list");
  assertEquals(res.status, 401);

  const body = await res.json();
  assertEquals(body.error, "Unauthorized");
});

Deno.test("/api endpoint returns 401 when api key invalid", async () => {
  setEnv();
  const app = buildApp();

  const res = await app.request("http://localhost/api/devices/list", {
    headers: { "x-api-key": "wrong" },
  });
  assertEquals(res.status, 401);

  const body = await res.json();
  assertEquals(body.error, "Unauthorized");
});
