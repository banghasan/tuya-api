import { getIrblasterData } from "../services/tuya.ts";

export async function irblasterCurrent(c: { json: (body: unknown, status?: number) => Response }) {
  try {
    const result = await getIrblasterData();
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
}

export async function irblasterStatus(c: { json: (body: unknown, status?: number) => Response }) {
  try {
    const result = await getIrblasterData();
    return c.json({
      datetime: result.datetime,
      timezone: result.timezone,
      status: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
}
