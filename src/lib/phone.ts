import { z } from 'zod';

/**
 * Rwandan phone number validation.
 *
 * Accepts the common ways a Rwandan mobile number is written:
 *   0788123456, 788123456, +250788123456, 250788123456, 0788 123 456
 * Mobile prefixes 072/073 (Airtel) and 078/079 (MTN) are covered by 7[2-9].
 */
export const RWANDA_PHONE_REGEX = /^(?:\+?250|0)?7[2-9]\d{7}$/;

/** Strips spaces, dots, dashes and parentheses so formatting does not matter. */
export function normalizePhone(input: string): string {
  return input.replace(/[\s().-]/g, '');
}

export function isValidPhone(input: string): boolean {
  return RWANDA_PHONE_REGEX.test(normalizePhone(input.trim()));
}

export const PHONE_ERROR = 'Enter a valid Rwandan phone number (e.g. 0788123456)';

/**
 * Zod schema for an optional phone field. Empty strings are allowed (treated as
 * "not provided"); any non-empty value must be a valid Rwandan number. The
 * parsed value is normalized (formatting removed).
 */
export const phoneField = z
  .string()
  .transform((v) => normalizePhone(v))
  .refine((v) => v === '' || RWANDA_PHONE_REGEX.test(v), { message: PHONE_ERROR });
