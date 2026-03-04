import { describe, it, expect } from 'vitest';
import { generateId } from '../id.js';

describe('generateId', () => {
  it('returns a 6-character string', () => {
    const id = generateId();
    expect(id).toHaveLength(6);
  });

  it('returns unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
