import { createFileRoute } from "@tanstack/react-router";
import AdminLayout from "@/lepdo/layouts/AdminLayout";
import { RequireRole } from "@/lepdo/guards";

function AdminShell() {
  return (
    <RequireRole staff>
      <AdminLayout />
    </RequireRole>
  );
}

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Workspace — LEPDO CONNECT" },
      { name: "description", content: "LEPDO team workspace for orders, customers and payments." },
      { property: "og:title", content: "Workspace — LEPDO CONNECT" },
      { property: "og:description", content: "LEPDO team workspace for orders, customers and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminShell,
});
