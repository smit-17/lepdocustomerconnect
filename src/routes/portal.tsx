import { createFileRoute } from "@tanstack/react-router";
import PortalLayout from "@/lepdo/layouts/PortalLayout";
import { RequireRole } from "@/lepdo/guards";

function PortalShell() {
  return (
    <RequireRole staff={false}>
      <PortalLayout />
    </RequireRole>
  );
}

export const Route = createFileRoute("/portal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Orders — LEPDO CONNECT" },
      { name: "description", content: "Your LEPDO orders, progress and documents." },
      { property: "og:title", content: "My Orders — LEPDO CONNECT" },
      { property: "og:description", content: "Your LEPDO orders, progress and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalShell,
});
