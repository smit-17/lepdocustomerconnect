import { createFileRoute } from "@tanstack/react-router";
import PortalExecutivePage from "@/lepdo/pages/portal/PortalExecutivePage";

export const Route = createFileRoute("/portal/executive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Assigned Executive — LEPDO CONNECT" },
      { name: "description", content: "Contact your LEPDO account executive by phone or WhatsApp." },
      { property: "og:title", content: "Assigned Executive — LEPDO CONNECT" },
      { property: "og:description", content: "Contact your LEPDO account executive by phone or WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalExecutivePage,
});
