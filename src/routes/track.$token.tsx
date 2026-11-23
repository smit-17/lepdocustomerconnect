import { createFileRoute } from '@tanstack/react-router';
import SharedOrderPage from '@/lepdo/pages/portal/SharedOrderPage';

export const Route = createFileRoute('/track/$token')({
  head: () => ({ meta: [
    { title: 'Shared order status — LEPDO CONNECT' },
    { name: 'description', content: 'Track your LEPDO order status and progress.' },
    { property: 'og:title', content: 'Shared order status — LEPDO CONNECT' },
    { property: 'og:description', content: 'Track your LEPDO order status and progress.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ] }),
  component: SharedOrderPage,
});