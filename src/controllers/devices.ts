import { requireEnv } from "../services/config.ts";
import { scanTuyaDevices } from "../services/tuya.ts";

export async function devicesScan(
  c: {
    req: { url: string };
    json: (body: unknown, status?: number) => Response;
  },
) {
  try {
    const query = new URL(c.req.url).searchParams;
    const result = await scanTuyaDevices(query);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
}

export function devicesList(
  c: { json: (body: unknown, status?: number) => Response },
) {
  try {
    const devices = [
      {
        name: "smartplug",
        id: requireEnv("TUYA_SMARTPLUG_ID"),
        ip: requireEnv("TUYA_SMARTPLUG_IP"),
        version: requireEnv("TUYA_SMARTPLUG_VERSION"),
      },
      {
        name: "irblaster",
        id: requireEnv("TUYA_IRBLASTER_ID"),
        ip: requireEnv("TUYA_IRBLASTER_IP"),
        version: requireEnv("TUYA_IRBLASTER_VERSION"),
      },
    ];
    return c.json({ devices });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
}
