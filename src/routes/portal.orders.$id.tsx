import { createFileRoute } from "@tanstack/react-router";
import PortalOrderPage from "@/lepdo/pages/portal/PortalOrderPage";

export const Route = createFileRoute("/portal/orders/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Order tracking — LEPDO CONNECT" },
      { name: "description", content: "Step-by-step tracking, invoices and shipping for your order." },
      { property: "og:title", content: "Order tracking — LEPDO CONNECT" },
      { property: "og:description", content: "Step-by-step tracking, invoices and shipping for your order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalOrderPage,
});
