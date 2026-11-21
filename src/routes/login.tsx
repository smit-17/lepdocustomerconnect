import { createFileRoute } from "@tanstack/react-router";
import LoginPage from "@/lepdo/pages/auth/LoginPage";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — LEPDO CONNECT" },
      { name: "description", content: "Sign in to LEPDO CONNECT to track your diamond and jewellery orders." },
      { property: "og:title", content: "Sign in — LEPDO CONNECT" },
      { property: "og:description", content: "Sign in to LEPDO CONNECT to track your diamond and jewellery orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});
