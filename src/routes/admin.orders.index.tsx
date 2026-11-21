import { createFileRoute } from "@tanstack/react-router";
import OrdersPage from "@/lepdo/pages/admin/OrdersPage";

export const Route = createFileRoute("/admin/orders/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Orders — LEPDO CONNECT" },
      { name: "description", content: "All diamond and jewellery orders with filters." },
      { property: "og:title", content: "Orders — LEPDO CONNECT" },
      { property: "og:description", content: "All diamond and jewellery orders with filters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});
