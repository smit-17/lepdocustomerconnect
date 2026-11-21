import { supabase } from './supabase';
import { run } from './api';

export const KYC_MAX_BYTES = 10 * 1024 * 1024;
export const PROOF_MAX_BYTES = 25 * 1024 * 1024;
export function validateCustomerFile(file: Pick<File, 'size' | 'type'>, max: number) {
  if (file.size <= 0 || file.size > max) throw new Error(`Choose a file up to ${max / 1024 / 1024} MB.`);
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a PDF, JPG, PNG or WebP file.');
}
export interface KycRecord { id: string; customer_id: string; status: string; document_url: string | null; submitted_at: string | null; rejection_reason: string | null }
export async function uploadCustomerFile(bucket: string, folder: string, file: File, max: number) {
  validateCustomerFile(file, max);
  const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_').slice(-100)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}
export function getKyc(customerId: string) {
  return run<KycRecord[]>(supabase.from('kyc_records').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }));
}
export async function previewKyc(path: string) {
  const { data, error } = await supabase.storage.from('customer-kyc').createSignedUrl(path, 60);
  if (error || !data) throw error || new Error('Could not open KYC file.');
  window.open(data.signedUrl, '_blank', 'noopener');
}