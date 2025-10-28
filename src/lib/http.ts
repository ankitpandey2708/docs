/**
 * HTTP Client Wrapper
 * Automatically injects Bearer tokens for authenticated API requests
 * Includes retry logic for 401 errors with token refresh
 */

import { getAccessToken, clearCachedToken } from '../auth/token';

interface WorkspaceCredentials {
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
 * @param workspace Workspace identifier (optional, will use default if not provided)
 * @param retryOn401 Whether to retry on 401 with token refresh (default: true)
 * @returns Response
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  workspace?: string,
  retryOn401: boolean = true
): Promise<Response> {
  try {
    // Fetch credentials for the workspace
    const credentials = await fetchCredentials(workspace);

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

      // Retry once with a new token
      return authenticatedFetch(url, options, workspace, false);
    }

    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Helper to make authenticated GET requests
 */
export async function authenticatedGet(
  url: string,
  workspace?: string
): Promise<Response> {
  return authenticatedFetch(url, { method: 'GET' }, workspace);
}

/**
 * Helper to make authenticated POST requests
 */
export async function authenticatedPost(
  url: string,
  body?: any,
  workspace?: string
): Promise<Response> {
  return authenticatedFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    workspace
  );
}

/**
 * Helper to make authenticated PUT requests
 */
export async function authenticatedPut(
  url: string,
  body?: any,
  workspace?: string
): Promise<Response> {
  return authenticatedFetch(
    url,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    workspace
  );
}

/**
 * Helper to make authenticated PATCH requests
 */
export async function authenticatedPatch(
  url: string,
  body?: any,
  workspace?: string
): Promise<Response> {
  return authenticatedFetch(
    url,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    workspace
  );
}

/**
 * Helper to make authenticated DELETE requests
 */
export async function authenticatedDelete(
  url: string,
  workspace?: string
): Promise<Response> {
  return authenticatedFetch(url, { method: 'DELETE' }, workspace);
}
