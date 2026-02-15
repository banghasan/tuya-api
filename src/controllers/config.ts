import { getApiKey } from "../services/config.ts";

type ConfigContext = {
  json: (body: unknown, status?: number) => Response;
};

export function publicConfig(c: ConfigContext) {
  return c.json({ requiresKey: Boolean(getApiKey()) });
}
