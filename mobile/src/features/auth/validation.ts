import { z } from 'zod';

import { isValidPhone } from '@/lib/phone';

const emailSchema = z.email();

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value.trim()).success;
}

export { isValidPhone };
