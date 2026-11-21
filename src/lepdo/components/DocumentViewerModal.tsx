import { useEffect, useState } from 'react';
import { Download, ExternalLink, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase, DOCS_BUCKET } from '../lib/supabase';
import { Button, Spinner } from './ui';

export interface ViewerFile { path: string; name: string; mime?: string | null; bucket?: string }

/** In-app preview for PDFs and images via short-lived signed URLs. */
export function DocumentViewerModal({ file, onClose }: { file: ViewerFile | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const bucket = file?.bucket || DOCS_BUCKET;
  const lower = (file?.name || file?.path || '').toLowerCase();
  const isPdf = file?.mime === 'application/pdf' || lower.endsWith('.pdf');
  const isImg = (file?.mime || '').startsWith('image/') || /\.(jpe?g|png|webp)$/.test(lower);

  useEffect(() => {
    setUrl(null); setErr(null); setZoom(1);
    if (!file) return;
    supabase.storage.from(bucket).createSignedUrl(file.path, 300).then(({ data, error }) => {
      if (error || !data) setErr('Could not open this file.'); else setUrl(data.signedUrl);
    });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [file, bucket, onClose]);

  if (!file) return null;
  async function download() {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(file!.path, 60, { download: file!.name });
    if (data) window.location.assign(data.signedUrl);
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={`Preview ${file.name}`} className="fixed inset-0 z-50 flex flex-col bg-brand-ink/80 p-2 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-indigo">{file.name}</p>
          {isImg && <>
            <Button variant="ghost" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
            <Button variant="ghost" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
            <Button variant="ghost" aria-label="Fit to width" onClick={() => setZoom(1)}><Maximize2 className="h-4 w-4" /></Button>
          </>}
          {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" className="inline-flex h-10 items-center px-2 text-brand-indigo"><ExternalLink className="h-4 w-4" /></a>}
          <Button variant="indigo" icon={<Download className="h-4 w-4" />} onClick={download}>Download</Button>
          <Button variant="ghost" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-cream-50">
          {err ? <p className="p-6 text-sm text-red-700">{err}</p>
            : !url ? <div className="flex h-full items-center justify-center"><Spinner /></div>
            : isPdf ? <iframe title={file.name} src={url} className="h-full min-h-[70vh] w-full" />
            : isImg ? <div className="p-3"><img src={url} alt={file.name} style={{ width: `${zoom * 100}%` }} className="mx-auto max-w-none" /></div>
            : <div className="p-6 text-sm"><p className="font-medium">{file.name}</p><p className="mt-1 text-muted-foreground">Preview isn't available for this file type.</p><Button className="mt-4" variant="indigo" onClick={download}>Download file</Button></div>}
        </div>
      </div>
    </div>
  );
}
