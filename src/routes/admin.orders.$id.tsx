import { createFileRoute } from "@tanstack/react-router";
import OrderDetailPage from "@/lepdo/pages/admin/OrderDetailPage";

export const Route = createFileRoute("/admin/orders/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Order — LEPDO CONNECT" },
      { name: "description", content: "Order progress, payments, documents and shipping." },
      { property: "og:title", content: "Order — LEPDO CONNECT" },
      { property: "og:description", content: "Order progress, payments, documents and shipping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderDetailPage,
});
