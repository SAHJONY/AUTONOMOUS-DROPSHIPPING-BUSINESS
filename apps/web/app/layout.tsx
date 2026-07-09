import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAHJONY Commerce — Autonomous Commerce, Operated for You",
  description:
    "SAHJONY Commerce is an autonomous commerce operator. An AI CEO and seven specialists run your business 24/7 — you approve only what matters, from an ultra-premium command deck.",
  metadataBase: new URL("https://sahjony.com"),
  openGraph: {
    title: "SAHJONY Commerce",
    description:
      "Autonomous commerce, operated for you. You approve only what matters.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
