import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "BOTANICA OCHOSI — Owner OS",
  description: "Private BOTANICA OCHOSI operating console.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.botanicaochosi.com/owner",
  },
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return children;
}
