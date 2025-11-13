/**
 * Token Management Utility
 * Handles OAuth2 client credentials flow with automatic token caching and refresh
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

// In-memory token cache (keyed by workspace)
const tokenCache = new Map<string, CachedToken>();

/**
 * Configuration for token acquisition
 */
interface TokenConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  workspace: string;
}

/**
 * Get access token using OAuth2 Client Credentials flow
 * Automatically caches tokens and refreshes when expired
 * 
 * @param config Token configuration
 * @returns Access token string
 */
export async function getAccessToken(config: TokenConfig): Promise<string> {
  const { tokenUrl, clientId, clientSecret, workspace } = config;

  // Check cache first (with 60 second buffer before expiry)
  const cached = tokenCache.get(workspace);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  try {
    // Make token request with Basic Auth
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token request failed (${response.status}): ${errorText}`);
    }

    const data: TokenResponse = await response.json();

    // Cache the token
    const expiresAt = Date.now() + (data.expires_in * 1000);
    tokenCache.set(workspace, {
      token: data.access_token,
      expiresAt,
    });

    return data.access_token;
  } catch (error) {
    throw new Error(`Failed to acquire access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear cached token for a workspace (useful for forced refresh)
 *
 * @param workspace Workspace identifier
 */
export function clearCachedToken(workspace: string): void {
  tokenCache.delete(workspace);
}
