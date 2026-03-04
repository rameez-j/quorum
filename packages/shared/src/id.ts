import { randomBytes } from 'node:crypto';

export function generateId(): string {
  return randomBytes(3).toString('hex');
}
