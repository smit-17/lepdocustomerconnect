import { z } from 'zod';

export const TRACKING_REFRESH_MS = 5_000;
export const trackingToken = z.string().regex(/^[0-9a-f]{64}$/);
export function customerTrackingUrl(token: string): string {
  return `https://lepdocustomerconnect.vercel.app/portal-share/${trackingToken.parse(token)}`;
}
export const trackingOrder = z.object({
  reference: z.string(),
  status: z.enum(['active', 'completed', 'cancelled']),
  current_stage_name: z.string().nullable(),
  progress_pct: z.number(),
  stages: z.array(z.object({
    stage_key: z.string(), name: z.string(),
    status: z.enum(['upcoming', 'in_progress', 'completed', 'attention', 'blocked', 'not_applicable']),
  })),
});