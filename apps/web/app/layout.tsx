import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ochosi-brand.css";

const CANONICAL_URL = "https://www.botanicaochosi.com";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_URL),
  title: {
    default: "BOTANICA OCHOSI — Botánica Cubana Online",
    template: "%s | BOTANICA OCHOSI",
  },
  description:
    "BOTANICA OCHOSI es una botánica cubana online con productos Lucumí, Yoruba e Ifá, catálogo conectado a Shopify, carrito persistente, compra segura y atención completamente en línea.",
  applicationName: "BOTANICA OCHOSI",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    title: "BOTANICA OCHOSI — Botánica Cubana Online",
    description:
      "Tradición cubana, productos Lucumí y Yoruba, catálogo real, compra segura y una experiencia digital moderna.",
    url: CANONICAL_URL,
    siteName: "BOTANICA OCHOSI",
    type: "website",
    locale: "es_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOTANICA OCHOSI",
    description: "Botánica cubana online · Lucumí · Yoruba · Ifá · tienda y atención en línea.",
  },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "BOTANICA OCHOSI", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07110b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
