/**
 * HTTP Client Wrapper
 * Automatically injects Bearer tokens for authenticated API requests
 * Includes retry logic for 401 errors with token refresh
 */

import { getAccessToken, clearCachedToken } from '../auth/token';

export interface WorkspaceCredentials {
  clientId: string;
  clientSecret: string;
  workspace: string;
  tokenUrl: string;
  apiBaseUrl: string;
  flowIds: {
    nerv: string;
    recurring: string;
  };
}

/**
 * Fetch workspace credentials from the backend
 * This maintains the existing credential resolution logic (Keycloak -> env)
 * 
 * @param workspace Workspace identifier (optional)
 * @returns Workspace credentials
 */
async function fetchCredentials(workspace?: string): Promise<WorkspaceCredentials> {
  const backendUrl = typeof window !== 'undefined' 
    ? (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin)
    : 'http://localhost:3001';

  let url = `${backendUrl}/api/workspace/credentials`;
  if (workspace) {
    url += `?workspace=${encodeURIComponent(workspace)}`;
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch credentials: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Make an authenticated HTTP request with automatic token injection
 *
 * @param url Request URL
 * @param options Fetch options
 * @param workspaceOrCredentials Workspace identifier (string) or pre-fetched credentials (object)
 * @param retryOn401 Whether to retry on 401 with token refresh (default: true)
 * @returns Response
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  workspaceOrCredentials?: string | WorkspaceCredentials,
  retryOn401: boolean = true
): Promise<Response> {
  try {
    // Use provided credentials or fetch them
    const credentials = typeof workspaceOrCredentials === 'object' && workspaceOrCredentials !== null
      ? workspaceOrCredentials
      : await fetchCredentials(typeof workspaceOrCredentials === 'string' ? workspaceOrCredentials : undefined);

    // Get or refresh access token
    const accessToken = await getAccessToken({
      tokenUrl: credentials.tokenUrl,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      workspace: credentials.workspace,
    });

    // Inject Authorization header
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 with retry (if enabled and not already retrying)
    if (response.status === 401 && retryOn401) {
      // Clear the cached token to force refresh
      clearCachedToken(credentials.workspace);

      // Retry once with a new token, passing the same credentials to avoid re-fetching
      return authenticatedFetch(url, options, credentials, false);
    }

    return response;
  } catch (error) {
    throw new Error(`Authenticated fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
