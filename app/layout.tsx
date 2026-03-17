import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spring Bank Demo",
  description: "SpringBank full-stack demo foundation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
