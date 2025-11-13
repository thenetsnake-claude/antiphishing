import * as crypto from 'crypto';

/**
 * Generate MD5 hash of input string
 * Used for cache key generation
 */
export function generateHash(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}
