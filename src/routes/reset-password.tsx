import { createFileRoute } from '@tanstack/react-router';
import SetPasswordPage from '@/lepdo/pages/auth/SetPasswordPage';

export const Route = createFileRoute('/reset-password')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Reset password — LEPDO CONNECT' },
    { name: 'description', content: 'Securely reset your LEPDO CONNECT account password from your email confirmation link.' },
    { property: 'og:title', content: 'Reset password — LEPDO CONNECT' },
    { property: 'og:description', content: 'Securely reset your LEPDO CONNECT account password from your email confirmation link.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: SetPasswordPage,
});