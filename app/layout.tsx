import "./globals.css";
import type { Metadata, Viewport } from "next";
import { TopBar } from "@/components/top-bar";

export const metadata: Metadata = {
  title: "Licentium Clockify",
  description: "Internal time tracker for Licentium",
  manifest: "/manifest.webmanifest",
  // iOS Safari "Add to Home Screen" honors these.
  appleWebApp: {
    capable: true,
    title: "Clockify",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Lets the page render under the iOS notch / Dynamic Island when in
  // standalone (PWA) mode.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  );
}
