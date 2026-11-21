import { createFileRoute } from "@tanstack/react-router";
import { Home } from "@/lepdo/guards";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Every Order. Every Step. Connected. — LEPDO CONNECT" },
      { name: "description", content: "LEPDO CONNECT — order tracking for LEPDO diamonds and fine jewellery." },
      { property: "og:title", content: "Every Order. Every Step. Connected. — LEPDO CONNECT" },
      { property: "og:description", content: "LEPDO CONNECT — order tracking for LEPDO diamonds and fine jewellery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});
