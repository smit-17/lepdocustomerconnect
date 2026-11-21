import { createFileRoute } from "@tanstack/react-router";
import CustomersPage from "@/lepdo/pages/admin/CustomersPage";

export const Route = createFileRoute("/admin/customers/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Customers — LEPDO CONNECT" },
      { name: "description", content: "LEPDO customer directory with executives and portal status." },
      { property: "og:title", content: "Customers — LEPDO CONNECT" },
      { property: "og:description", content: "LEPDO customer directory with executives and portal status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});
