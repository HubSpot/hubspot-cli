import { describe, it, expect } from 'vitest';
import { summarizeNpmAuditJson } from '../npmAuditOnUpload.js';

describe('summarizeNpmAuditJson', () => {
  it('returns null for clean audit metadata', () => {
    const source = JSON.stringify({
      metadata: { vulnerabilities: { total: 0 } },
    });
    expect(summarizeNpmAuditJson(source)).toBeNull();
  });

  it('returns summary when vulnerabilities are present', () => {
    const source = JSON.stringify({
      metadata: {
        vulnerabilities: {
          total: 3,
          low: 1,
          high: 2,
        },
      },
    });
    expect(summarizeNpmAuditJson(source)).toBe('3 total (2 high, 1 low)');
  });

  it('returns error message from audit error object', () => {
    const source = JSON.stringify({
      error: { message: 'Lockfile not found' },
    });
    expect(summarizeNpmAuditJson(source)).toBe('Lockfile not found');
  });

  it('returns error summary when message is absent', () => {
    const source = JSON.stringify({
      error: {
        code: 'ENOLOCK',
        summary: 'This command requires an existing lockfile.',
      },
    });
    expect(summarizeNpmAuditJson(source)).toBe(
      'This command requires an existing lockfile.'
    );
  });

  it('returns null for invalid JSON', () => {
    expect(summarizeNpmAuditJson('not json')).toBeNull();
  });
});
