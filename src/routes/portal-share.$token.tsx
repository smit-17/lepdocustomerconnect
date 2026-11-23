import { createFileRoute } from '@tanstack/react-router';
import SharedOrderPage from '@/lepdo/pages/portal/SharedOrderPage';

export const Route = createFileRoute('/portal-share/$token')({
  head: () => ({ meta: [
    { title: 'Shared customer profile — LEPDO CONNECT' },
    { name: 'description', content: 'View your shared LEPDO customer profile, orders and live progress.' },
    { property: 'og:title', content: 'Shared customer profile — LEPDO CONNECT' },
    { property: 'og:description', content: 'View your shared LEPDO customer profile, orders and live progress.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ] }),
  component: SharedOrderPage,
});