import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Commerce OS",
  description: "Autonomous AI dropshipping operator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
