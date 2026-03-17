import { readFile } from "node:fs/promises";
import path from "node:path";

const LEGACY_ROOT = path.join(process.cwd(), "public", "legacy");

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

export function addNonceToScripts(html: string, nonce: string): string {
  return html.replace(/<script\b(?![^>]*\bnonce=)([^>]*)>/gi, (_match, attrs = "") => {
    return `<script nonce="${nonce}"${attrs}>`;
  });
}

export async function loadLegacyPage(fileName: string): Promise<string> {
  const fullPath = path.join(LEGACY_ROOT, fileName);
  const html = await readFile(fullPath, "utf8");
  return extractBody(html);
}
