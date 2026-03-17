import { createHash } from "node:crypto";

const baseUrl = process.argv[2] || "http://127.0.0.1:3001";
const pages = ["/", "/business", "/about", "/contact", "/help", "/security", "/terms", "/signin"];

function hashScript(source) {
  return `sha256-${createHash("sha256").update(source).digest("base64")}`;
}

for (const page of pages) {
  const response = await fetch(new URL(page, baseUrl));
  if (!response.ok) {
    console.error(`Failed to fetch ${page}: ${response.status} ${response.statusText}`);
    process.exitCode = 1;
    continue;
  }

  const html = await response.text();
  const matches = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)];

  console.log(`PAGE ${page} scripts=${matches.length}`);

  matches.forEach((match, index) => {
    const attrs = match[1] || "";
    const body = match[2];
    const type = attrs.match(/type=["']([^"']+)["']/i)?.[1] || "text/javascript";
    const preview = body.trim().replace(/\s+/g, " ").slice(0, 96);

    console.log(JSON.stringify({
      page,
      index: index + 1,
      type,
      hash: hashScript(body),
      length: body.length,
      preview
    }));
  });
}
