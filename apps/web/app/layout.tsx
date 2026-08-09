import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOTANICA OCHOSI — Botánica Cubana Inteligente",
  description:
    "BOTANICA OCHOSI is an AI-assisted Cuban botanica experience with a live Shopify catalog, intelligent discovery, autonomous commerce operations, and owner-controlled high-risk actions.",
  metadataBase: new URL("https://autonomous-dropshipping-business.vercel.app"),
  openGraph: {
    title: "BOTANICA OCHOSI",
    description:
      "Tradición, catálogo real y una nueva experiencia digital para una botánica cubana.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07110b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
