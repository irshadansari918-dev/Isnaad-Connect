import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Isnaad Connect",
    short_name: "Connect",
    description:
      "Conversations, tasks, and tickets for Isnaad and its clients.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1B2A4A", // --isnaad-navy
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
