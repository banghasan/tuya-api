const htmlPath = new URL("./dashboard.html", import.meta.url);

const htmlTemplate = await Deno.readTextFile(htmlPath);

export function buildDashboardHtml(): string {
  return htmlTemplate;
}
