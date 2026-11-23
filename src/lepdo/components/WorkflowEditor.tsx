import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from './ui';
import { useToast } from './Toast';
import { errorMessage } from '../lib/format';
import { moveItem, workflowDefinition, type WorkflowDefinition, type WorkflowField } from '../lib/workflow-editor';

export function WorkflowEditor({ initial, onSave, onReset }: { initial: WorkflowDefinition; onSave: (value: WorkflowDefinition) => Promise<void>; onReset?: () => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const update = (index: number, patch: Partial<WorkflowDefinition[number]>) => setValue(v => v.map((s, i) => i === index ? { ...s, ...patch } : s));
  const updateField = (index: number, fieldIndex: number, patch: Partial<WorkflowField>) => update(index, { fields: (value[index]?.fields ?? []).map((f, i) => i === fieldIndex ? { ...f, ...patch } : f) });
  async function save(reset = false) {
    if (reset && !window.confirm('Restore the original workflow for all existing and future orders of this type? Completed progress and history will be retained.')) return;
    setBusy(true);
    try { if (reset && onReset) await onReset(); else await onSave(workflowDefinition.parse(value)); toast.success(reset ? 'Default workflow restored' : 'Workflow saved'); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  return <fieldset disabled={busy} className="min-w-0 space-y-4">
    {value.map((s, index) => <section key={s.key} className="border-b border-border pb-4">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <span className="mr-auto text-sm font-semibold text-brand-indigo">{index + 1}. {s.name || 'Untitled step'}</span>
        <Button size="sm" variant="ghost" title="Move stage up" aria-label={`Move stage ${index + 1} up`} disabled={index === 0} onClick={() => setValue(v => moveItem(v, index, -1))} icon={<ArrowUp className="h-4 w-4" />} />
        <Button size="sm" variant="ghost" title="Move stage down" aria-label={`Move stage ${index + 1} down`} disabled={index === value.length - 1} onClick={() => setValue(v => moveItem(v, index, 1))} icon={<ArrowDown className="h-4 w-4" />} />
        <Button size="sm" variant="ghost" title="Delete stage" aria-label={`Delete stage ${index + 1}`} disabled={value.length === 1} onClick={() => setValue(v => v.filter(x => x.key !== s.key))} icon={<Trash2 className="h-4 w-4" />} />
      </div>
      <div className="space-y-3">
        <Field label={`Stage ${index + 1} name`}><Input maxLength={120} value={s.name} onChange={e => update(index, { name: e.target.value })} /></Field>
        <Field label={`Stage ${index + 1} description`}><Textarea rows={2} maxLength={2000} value={s.description} onChange={e => update(index, { description: e.target.value })} /></Field>
        {s.fields.map((f, fieldIndex) => <div key={f.key} className="space-y-2 border-l-2 border-border pl-3">
          <div className="flex flex-wrap items-end gap-1">
            <Field className="min-w-0 flex-1 basis-36" label={`Field ${fieldIndex + 1} label`}><Input value={f.label} maxLength={200} onChange={e => updateField(index, fieldIndex, { label: e.target.value })} /></Field>
            <Button size="sm" variant="ghost" title="Move field up" aria-label={`Move field ${fieldIndex + 1} up`} disabled={fieldIndex === 0} onClick={() => update(index, { fields: moveItem(s.fields, fieldIndex, -1) })} icon={<ArrowUp className="h-4 w-4" />} />
            <Button size="sm" variant="ghost" title="Move field down" aria-label={`Move field ${fieldIndex + 1} down`} disabled={fieldIndex === s.fields.length - 1} onClick={() => update(index, { fields: moveItem(s.fields, fieldIndex, 1) })} icon={<ArrowDown className="h-4 w-4" />} />
            <Button size="sm" variant="ghost" title="Delete field" aria-label={`Delete field ${fieldIndex + 1}`} onClick={() => update(index, { fields: s.fields.filter(x => x.key !== f.key) })} icon={<Trash2 className="h-4 w-4" />} />
          </div>
          <Field label={`Field ${fieldIndex + 1} type`}><Select value={f.type} onChange={e => updateField(index, fieldIndex, { type: e.target.value as WorkflowField['type'] })}><option value="checkbox">Checkbox</option><option value="text">Text input</option><option value="textarea">Long text</option><option value="number">Number input</option><option value="date">Date input</option></Select></Field>
          <Field label={`Field ${fieldIndex + 1} description`}><Input value={f.description ?? ''} maxLength={2000} onChange={e => updateField(index, fieldIndex, { description: e.target.value })} /></Field>
        </div>)}
        <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => update(index, { fields: [...s.fields, { key: `field_${crypto.randomUUID().replace(/-/g, '')}`, label: '', type: 'checkbox' }] })}>Add field</Button>
      </div>
    </section>)}
    <div className="flex flex-wrap gap-2">
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => setValue(v => [...v, { key: `custom_${crypto.randomUUID().replace(/-/g, '')}`, name: '', description: '', fields: [] }])}>Add stage</Button>
      <Button variant="primary" loading={busy} onClick={() => save()}>Save Changes</Button>
      {onReset && <Button variant="danger" onClick={() => save(true)}>Reset to Default</Button>}
    </div>
  </fieldset>;
}