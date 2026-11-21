import { createFileRoute } from "@tanstack/react-router";
import PortalHomePage from "@/lepdo/pages/portal/PortalHomePage";

export const Route = createFileRoute("/portal/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Orders — LEPDO CONNECT" },
      { name: "description", content: "Your active LEPDO orders at a glance." },
      { property: "og:title", content: "My Orders — LEPDO CONNECT" },
      { property: "og:description", content: "Your active LEPDO orders at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalHomePage,
});
