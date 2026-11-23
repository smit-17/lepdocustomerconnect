import { z } from 'zod';
import { stageDetails } from './workflows';
import type { OrderType, Stage } from './types';

export const workflowField = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_]{1,100}$/),
  label: z.string().max(200).default(''),
  type: z.enum(['checkbox', 'text', 'number', 'date', 'textarea']),
  description: z.string().max(2000).optional(),
});
export const stageSchema = z.object({ description: z.string().max(2000).default(''), fields: z.array(workflowField).max(100) });
export const workflowDefinition = z.array(stageSchema.extend({ key: z.string().regex(/^[a-zA-Z0-9_]{1,100}$/), name: z.string().max(120).default('') })).min(1).max(100).superRefine((stages, ctx) => {
  if (new Set(stages.map(s => s.key)).size !== stages.length) ctx.addIssue({ code: 'custom', message: 'Duplicate stage keys' });
  stages.forEach(s => { if (new Set(s.fields.map(f => f.key)).size !== s.fields.length) ctx.addIssue({ code: 'custom', message: 'Duplicate field keys' }); });
});
export type WorkflowField = z.infer<typeof workflowField>;
export type WorkflowDefinition = z.infer<typeof workflowDefinition>;
export type StageSchema = z.infer<typeof stageSchema>;

export function schemaForStage(type: OrderType, stage: { stage_key: string; ui_schema?: StageSchema | null }): StageSchema {
  return stage.ui_schema ?? { description: '', fields: stageDetails(type, stage.stage_key).map(f => ({ ...f, type: 'checkbox' })) };
}
export function orderWorkflow(type: OrderType, stages: readonly Stage[]): WorkflowDefinition {
  return stages.map(s => ({ key: s.stage_key, name: s.name, ...schemaForStage(type, s) }));
}
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const result = [...items];
  const item = result[index];
  const neighbor = result[index + direction];
  if (item === undefined || neighbor === undefined) return result;
  result[index] = neighbor; result[index + direction] = item;
  return result;
}
export function optionalPaymentAmount(value: string): number {
  const amount = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be a non-negative number.');
  return amount;
}