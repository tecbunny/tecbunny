import { describe, expect, it } from 'vitest';

import { parseTaxClassification, TaxClassificationError } from '../ai/tax-classification';

describe('tax-classification', () => {
  it('accepts strict Gemini JSON for an 8-digit HSN and statutory GST tier', () => {
    expect(parseTaxClassification(JSON.stringify({
      hsn_code: '85258900',
      gst_rate: 18,
      confidence_score: 0.95,
      justification: 'Matches IP Closed Circuit Television cameras under electronic equipment schedules.',
    }))).toEqual({
      hsn_code: '85258900',
      gst_rate: 18,
      confidence_score: 0.95,
      justification: 'Matches IP Closed Circuit Television cameras under electronic equipment schedules.',
    });
  });

  it('extracts JSON from markdown fences but still enforces the schema', () => {
    const result = parseTaxClassification(`\`\`\`json
{
  "hsn_code": "84713010",
  "gst_rate": "18.00",
  "confidence_score": 0.91,
  "justification": "Portable automatic data processing machine classification for laptop computers."
}
\`\`\``);

    expect(result.gst_rate).toBe(18);
    expect(result.hsn_code).toBe('84713010');
  });

  it('rejects non-8-digit HSN values and non-standard GST rates', () => {
    expect(() => parseTaxClassification(JSON.stringify({
      hsn_code: '8471',
      gst_rate: 17,
      confidence_score: 0.9,
      justification: 'Invalid output should not be accepted for product tax persistence.',
    }))).toThrow(TaxClassificationError);
  });
});
