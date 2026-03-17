import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { addNonceToScripts, loadLegacyPage } from "@/lib/legacy/loadLegacyPage";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};


const PAGE_MAP: Record<string, string> = {
  about: "about.html",
  business: "business.html",
  "atm-branch": "atm-branch.html",
  contact: "contact.html",
  help: "help.html",
  privacy: "privacy.html",
  security: "security.html",
  terms: "terms.html",
  demo2: "demo2.html",
  
};

function normalizeLinks(html: string) {
  return html
    .replaceAll('href="index.html"', 'href="/"')
    .replace(/href="([a-z0-9-]+)\.html"/gi, 'href="/$1"')
    .replace(/href="\.\.\/index.html"/gi, 'href="/"')
    .replace(/href="\.\.\/([a-z0-9-]+)\.html"/gi, 'href="/$1"')
    .replace(/href="\/es\/index.html"/gi, 'href="/es"');
}

export default async function LegacyPage({ params }: PageProps) {
  const nonce = (await headers()).get("x-nonce");
  const { slug = [] } = await params;
  const key = slug.join("/");
  const fileName = PAGE_MAP[key];
  if (!fileName) notFound();

  const body = normalizeLinks(await loadLegacyPage(fileName));
  const html = nonce ? addNonceToScripts(body, nonce) : body;
  return <main className="legacy-page" dangerouslySetInnerHTML={{ __html: html }} />;
}
