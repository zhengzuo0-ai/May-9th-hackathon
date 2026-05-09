import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "West Africa License Recon",
  description: "GPT-5.5 and Exa-powered Côte d’Ivoire license-package intelligence workstation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
