/**
 * Shared constants for common HTTP headers and configurations
 */

export const HEADERS = {
  JSON: { 'Content-Type': 'application/json' } as const,
  FORM_URLENCODED: { 'Content-Type': 'application/x-www-form-urlencoded' } as const,
};
