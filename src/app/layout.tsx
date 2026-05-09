import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concession Recon",
  description: "GPT-5.5 mining concession intelligence workstation",
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
