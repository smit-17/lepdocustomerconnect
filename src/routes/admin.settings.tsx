import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "@/lepdo/pages/admin/SettingsPage";

export const Route = createFileRoute("/admin/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — LEPDO CONNECT" },
      { name: "description", content: "Company profile, team members and invitations." },
      { property: "og:title", content: "Settings — LEPDO CONNECT" },
      { property: "og:description", content: "Company profile, team members and invitations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});
