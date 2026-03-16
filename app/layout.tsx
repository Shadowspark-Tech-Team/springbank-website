import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spring Bank Demo",
  description: "SpringBank full-stack demo foundation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="/legacy/main.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
