import { createFileRoute } from "@tanstack/react-router";
import PortalProfilePage from "@/lepdo/pages/portal/PortalProfilePage";

export const Route = createFileRoute("/portal/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Profile — LEPDO CONNECT" },
      { name: "description", content: "Your contact details, company and password." },
      { property: "og:title", content: "My Profile — LEPDO CONNECT" },
      { property: "og:description", content: "Your contact details, company and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalProfilePage,
});
