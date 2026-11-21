import { describe, expect, it } from 'vitest';
import { INVOICE_STEPS, parseInvoiceAmount } from '@/lepdo/lib/workflows';

describe('Invoice step rules from the uploaded update', () => {
  it('uses the proforma document and amount for the proforma step', () => {
    expect(INVOICE_STEPS['proforma']?.docType).toBe('proforma_invoice');
    expect(INVOICE_STEPS['proforma']?.amountField).toBe('proforma_amount');
  });
  it('uses the final document, amount and issued detail for the final invoice step', () => {
    expect(INVOICE_STEPS['final_invoice']?.docType).toBe('final_invoice');
    expect(INVOICE_STEPS['final_invoice']?.amountField).toBe('final_invoice_amount');
    expect(INVOICE_STEPS['final_invoice']?.detailKey).toBe('final_invoice_issued');
  });
  it('accepts non-negative invoice amounts and leaves a blank amount unset', () => {
    expect(parseInvoiceAmount('1,250.50')).toBe(1250.5);
    expect(parseInvoiceAmount('0')).toBe(0);
    expect(parseInvoiceAmount('  ')).toBeNull();
    expect(() => parseInvoiceAmount('-1')).toThrow();
    expect(() => parseInvoiceAmount('Infinity')).toThrow();
    expect(() => parseInvoiceAmount('invalid')).toThrow();
  });
});