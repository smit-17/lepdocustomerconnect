import { createFileRoute } from '@tanstack/react-router';
import PortalTermsPage from '@/lepdo/pages/portal/PortalTermsPage';
export const Route = createFileRoute('/portal/terms')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Terms & Conditions — LEPDO CONNECT' },
    { name: 'description', content: 'Review and accept the LEPDO B2B order terms.' },
    { property: 'og:title', content: 'Terms & Conditions — LEPDO CONNECT' },
    { property: 'og:description', content: 'Review and accept the LEPDO B2B order terms.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: PortalTermsPage,
});