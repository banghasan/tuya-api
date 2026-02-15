import { formatDateTimeTZ } from "../services/time.ts";
import { getSmartplugData, setSmartplugPower } from "../services/tuya.ts";

function buildSmartplugOffline(errorMessage: string) {
  const { datetime, timezone } = formatDateTimeTZ(new Date());
  return {
    datetime,
    timezone,
    status: "OFFLINE",
    watt: null,
    volt: null,
    ampere: null,
    total_kwh: null,
    raw_dps: {},
    error: errorMessage,
  };
}

export async function smartplugCurrent(
  c: { json: (body: unknown, status?: number) => Response },
) {
  try {
    const result = await getSmartplugData();
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(buildSmartplugOffline(message));
  }
}

export async function smartplugStatus(
  c: { json: (body: unknown, status?: number) => Response },
) {
  try {
    const result = await getSmartplugData();
    return c.json({
      datetime: result.datetime,
      timezone: result.timezone,
      status: result.status === "ON",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { datetime, timezone } = formatDateTimeTZ(new Date());
    return c.json({ datetime, timezone, status: false, error: message });
  }
}

export async function smartplugOn(
  c: { json: (body: unknown, status?: number) => Response },
) {
  try {
    const result = await setSmartplugPower(true);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(buildSmartplugOffline(message));
  }
}

export async function smartplugOff(
  c: { json: (body: unknown, status?: number) => Response },
) {
  try {
    const result = await setSmartplugPower(false);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(buildSmartplugOffline(message));
  }
}
