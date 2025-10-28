/**
 * Shared utility functions
 */

/**
 * Get backend URL based on environment
 * Returns localhost URL for local development, otherwise uses current origin
 */
export function getBackendUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }
  return window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : window.location.origin;
}

/**
 * Build credentials URL with optional workspace parameter
 * @param workspace Optional workspace identifier
 * @returns Complete credentials URL
 */
export function buildCredentialsUrl(workspace?: string): string {
  const baseUrl = `${getBackendUrl()}/api/workspace/credentials`;
  return workspace ? `${baseUrl}?workspace=${encodeURIComponent(workspace)}` : baseUrl;
}

/**
 * Extract workspace from authentication context
 * @param authContext Authentication context object
 * @returns Workspace identifier or undefined
 */
export function extractWorkspace(authContext: any): string | undefined {
  return authContext?.providerData?.user?.publicMetadata?.workspace;
}

/**
 * Get attribute value with case-insensitive fallback
 * Tries uppercase key first, then lowercase
 * @param attributes Attributes object
 * @param upperCaseKey Uppercase version of the key
 * @param lowerCaseKey Lowercase version of the key
 * @returns Attribute value or undefined
 */
export function getAttributeValue(
  attributes: Record<string, any>,
  upperCaseKey: string,
  lowerCaseKey: string
): string | undefined {
  return attributes[upperCaseKey] || attributes[lowerCaseKey];
}
