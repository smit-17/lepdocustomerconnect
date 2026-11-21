import { createFileRoute } from "@tanstack/react-router";
import CustomerDetailPage from "@/lepdo/pages/admin/CustomerDetailPage";

export const Route = createFileRoute("/admin/customers/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Customer — LEPDO CONNECT" },
      { name: "description", content: "Customer details, contacts and order history." },
      { property: "og:title", content: "Customer — LEPDO CONNECT" },
      { property: "og:description", content: "Customer details, contacts and order history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetailPage,
});
