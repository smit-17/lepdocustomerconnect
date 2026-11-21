import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as typedClient } from '@/integrations/supabase/client';

// The LEPDO screens use their own hand-written row types (src/lepdo/lib/types.ts),
// so they talk to the shared client without the generated schema typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typedClient as unknown as SupabaseClient<any, 'public', any>;
export const isConfigured = true;
export const isDemoMode = false;

export const DOCS_BUCKET = 'order-documents';
export const AVATAR_BUCKET = 'avatars';
