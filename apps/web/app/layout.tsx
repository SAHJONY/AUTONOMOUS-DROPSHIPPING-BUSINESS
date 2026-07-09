import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Commerce OS — Autonomous Dropshipping, Operated by AI",
  description:
    "An autonomous commerce operator. A Claude Fable 5 CEO agent and seven specialists run your dropshipping business 24/7 — you approve only what matters, from an ultra-premium command deck.",
  metadataBase: new URL("https://autonomous-dropshipping-business.vercel.app"),
  openGraph: {
    title: "Claude Commerce OS",
    description:
      "Autonomous dropshipping, operated by a Claude Fable 5 brain. You approve only what matters.",
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
