import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Standard e-Sign | Enterprise Digital Signatures & Section 65B Audit Trail",
  description:
    "Enterprise-grade digital signature and document workflow platform with Aadhaar/PAN KYC, Section 65B court-admissible audit certificates, and biometric geo-verification.",
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

