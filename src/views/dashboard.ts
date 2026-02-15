export type DashboardOptions = {
  requiresKey: boolean;
  refreshMs: number;
  maxPoints: number;
  maxWatt: number;
  maxAmpere: number;
};

const htmlPath = new URL("./dashboard.html", import.meta.url);
const cssPath = new URL("./dashboard.css", import.meta.url);
const jsPath = new URL("./dashboard.js", import.meta.url);

const htmlTemplate = await Deno.readTextFile(htmlPath);
const css = await Deno.readTextFile(cssPath);
const js = await Deno.readTextFile(jsPath);

export function buildDashboardHtml(options: DashboardOptions): string {
  return htmlTemplate
    .replace("{{DASHBOARD_CSS}}", css)
    .replace("{{DASHBOARD_JS}}", js)
    .replace("{{REQUIRES_KEY}}", options.requiresKey ? "1" : "0")
    .replace("{{REFRESH_MS}}", String(options.refreshMs))
    .replace("{{MAX_POINTS}}", String(options.maxPoints))
    .replace("{{MAX_WATT}}", String(options.maxWatt))
    .replace("{{MAX_AMPERE}}", String(options.maxAmpere));
}
