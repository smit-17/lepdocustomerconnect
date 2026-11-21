import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/lepdo/pages/admin/Dashboard";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — LEPDO CONNECT" },
      { name: "description", content: "Active orders, balances and orders needing attention." },
      { property: "og:title", content: "Dashboard — LEPDO CONNECT" },
      { property: "og:description", content: "Active orders, balances and orders needing attention." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
