import type { MetadataRoute } from "next";

// Next.js auto-routes this to /manifest.webmanifest and injects
// <link rel="manifest" href="/manifest.webmanifest"> into <head>.
//
// PWA install flow:
//   - iOS Safari: Share → Add to Home Screen (no JS prompt available)
//   - Android Chrome: shows an "Install app" banner when criteria are met
//
// We point modern browsers at the SVG icon (scales perfectly) and provide a
// PNG fallback at /apple-icon (generated on-the-fly by app/apple-icon.tsx
// via next/og ImageResponse) for iOS, which still prefers PNG.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Licentium Clockify",
    short_name: "Clockify",
    description: "Internal time tracker for Licentium",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
