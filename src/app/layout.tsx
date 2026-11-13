import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StandardRoofs Sign | E-Signature & Fabrication Approvals",
  description:
    "Unlimited self-hosted e-signature platform for Standard Roofs quotations, fabrication drawings, work orders, and handover certificates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

