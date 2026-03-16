#!/usr/bin/env bash
set -euo pipefail

echo "Working directory: $(pwd)"

python3 <<'PY'
from pathlib import Path
import re

def patch_admin():
    p = Path("app/admin/page.tsx")
    if not p.exists():
        print("skip: app/admin/page.tsx not found")
        return
    s = p.read_text()

    if 'type Props = {' not in s and 'type AdminPageProps = {' not in s:
        s = re.sub(
            r'import \{ formatCurrency, getAdminApprovalData, maskAccountNumber \} from "@/lib/banking/service";\n',
            'import { formatCurrency, getAdminApprovalData, maskAccountNumber } from "@/lib/banking/service";\n\n'
            'type AdminPageProps = {\n'
            '  searchParams?: Promise<{\n'
            '    success?: string;\n'
            '    error?: string;\n'
            '  }>;\n'
            '};\n',
            s,
            count=1
        )

    s = re.sub(
        r'export default async function AdminPage\(\{\s*searchParams\s*\}:\s*\{\s*searchParams\??:\s*\{\s*success\??:\s*string;?\s*error\??:\s*string;?\s*\}\s*\}\)',
        'export default async function AdminPage({ searchParams }: AdminPageProps)',
        s
    )

    s = re.sub(
        r'export default async function AdminPage\(\{\s*searchParams\s*\}:\s*AdminPageProps\)\s*\{\s*(?!const resolvedSearchParams =)',
        'export default async function AdminPage({ searchParams }: AdminPageProps) {\n  const resolvedSearchParams = searchParams ? await searchParams : undefined;\n',
        s
    )

    if 'const resolvedSearchParams = searchParams ? await searchParams : undefined;' not in s:
        s = s.replace(
            'export default async function AdminPage({ searchParams }: AdminPageProps) {',
            'export default async function AdminPage({ searchParams }: AdminPageProps) {\n  const resolvedSearchParams = searchParams ? await searchParams : undefined;'
        )

    s = s.replace('searchParams?.success', 'resolvedSearchParams?.success')
    s = s.replace('searchParams?.error', 'resolvedSearchParams?.error')
    s = s.replace('{searchParams.success}', '{resolvedSearchParams.success}')
    s = s.replace('{searchParams.error}', '{resolvedSearchParams.error}')

    p.write_text(s)
    print("patched: app/admin/page.tsx")

def patch_slug():
    p = Path("app/[...slug]/page.tsx")
    if not p.exists():
        print("skip: app/[...slug]/page.tsx not found")
        return
    s = p.read_text()

    has_pageprops = 'type PageProps = {' in s or 'interface PageProps' in s
    if not has_pageprops:
        s = re.sub(
            r'(^.*?import .*?;\n(?:^.*?import .*?;\n)*)',
            lambda m: m.group(1) + '\n' +
            'type PageProps = {\n'
            '  params: Promise<{\n'
            '    slug?: string[];\n'
            '  }>;\n'
            '};\n\n',
            s,
            count=1,
            flags=re.M | re.S
        )

    s = re.sub(
        r'export default async function (\w+)\(\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*slug\??:\s*string\[\]\s*\}\s*\}\)',
        r'export default async function \1({ params }: PageProps)',
        s
    )

    s = re.sub(
        r'export default async function Page\(\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*slug\??:\s*string\[\]\s*\}\s*\}\)',
        'export default async function Page({ params }: PageProps)',
        s
    )

    if 'const { slug = [] } = await params;' not in s:
        s = re.sub(
            r'(export default async function \w+\(\{ params \}: PageProps\) \{)\n',
            r'\1\n  const { slug = [] } = await params;\n',
            s,
            count=1
        )

    s = re.sub(
        r'(?<!await )params\.slug',
        'slug',
        s
    )

    p.write_text(s)
    print("patched: app/[...slug]/page.tsx")

patch_admin()
patch_slug()
PY

npm install
npm run prisma:generate || true
npm run build

git add app/admin/page.tsx app/[...slug]/page.tsx || true
git add -A
git commit -m "Fix Next.js 15 PageProps typing for admin and slug pages" || echo "Nothing to commit"
git push

npx vercel --prod
