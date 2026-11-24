import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/account-actions')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleAccountAction } = await import('@/lepdo/lib/account-actions.server');
      return handleAccountAction(request);
    },
  } },
});