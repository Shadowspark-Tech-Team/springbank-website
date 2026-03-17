import { headers } from "next/headers";
import { addNonceToScripts, loadLegacyPage } from "@/lib/legacy/loadLegacyPage";

function normalizeLinks(html: string) {
  return html
    .replaceAll('href="index.html"', 'href="/"')
    .replace(/href="([a-z0-9-]+)\.html"/gi, 'href="/$1"')
    .replace(/href="es\/index.html"/gi, 'href="/es"')
    .replaceAll('href="signin.html"', 'href="/signin"');
}

export default async function HomePage() {
  const nonce = (await headers()).get("x-nonce");
  const body = normalizeLinks(await loadLegacyPage("index.html"));
  const html = nonce ? addNonceToScripts(body, nonce) : body;
  return <main className="legacy-page" dangerouslySetInnerHTML={{ __html: html }} />;
}
