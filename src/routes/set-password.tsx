import { createFileRoute } from "@tanstack/react-router";
import SetPasswordPage from "@/lepdo/pages/auth/SetPasswordPage";

export const Route = createFileRoute("/set-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set your password — LEPDO CONNECT" },
      { name: "description", content: "Create or reset your LEPDO CONNECT password." },
      { property: "og:title", content: "Set your password — LEPDO CONNECT" },
      { property: "og:description", content: "Create or reset your LEPDO CONNECT password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetPasswordPage,
});
