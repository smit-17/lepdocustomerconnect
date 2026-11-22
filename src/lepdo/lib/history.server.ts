type HistoryClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
type FileClient = {
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: { message: string } | null }> } };
};

export async function removeHistory(caller: HistoryClient, files: () => Promise<FileClient>, orderId: string | null, confirmation: string) {
  const allowed = await caller.rpc('is_admin');
  if (allowed.error || allowed.data !== true) throw new Error('Only administrators can delete order history.');
  if (orderId === null && confirmation !== 'RESET HISTORY') throw new Error('Type RESET HISTORY to confirm.');
  const result = await caller.rpc('admin_delete_order_history', { p_order_id: orderId, p_confirmation: confirmation });
  if (result.error) throw new Error(result.error.message);
  const data = result.data as { deleted_count: number; paths: string[] };
  let cleanupPending = false;
  if (data.paths.length) {
    try {
      const admin = await files();
      for (let i = 0; i < data.paths.length; i += 100) {
        const removed = await admin.storage.from('order-documents').remove(data.paths.slice(i, i + 100));
        if (removed.error) cleanupPending = true;
      }
    } catch { cleanupPending = true; }
  }
  return { deletedCount: data.deleted_count, cleanupPending };
}