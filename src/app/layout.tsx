import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LPG ERP | Fusion4o",
  description: "LPG distribution ERP powered by Fusion4o",
  icons: {
    icon: "/fusion4o-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
