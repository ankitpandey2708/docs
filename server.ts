import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// CORS configuration - allow docs app origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://docs.finarkein.com' // Production docs origin
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false // Not using cookies
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
 * Fetch credentials from Keycloak
 * Returns null if Keycloak is not configured or fetch fails
 */
async function fetchCredentialsFromKeycloak(workspace: string): Promise<WorkspaceCredentials | null> {
  const keycloakUrl = process.env.KEYCLOAK_URL;
  const keycloakRealm = process.env.KEYCLOAK_REALM;
  const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID;
  const keycloakClientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

  // If Keycloak is not configured, return null to fall back to env vars
  if (!keycloakUrl || !keycloakRealm || !keycloakClientId || !keycloakClientSecret) {
    return null;
  }

  try {
    // Step 1: Get admin access token from Keycloak
    const tokenUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: keycloakClientId,
        client_secret: keycloakClientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      return null;
    }

    const tokenData = await tokenResponse.json();
    const adminToken = tokenData.access_token;

    // Step 2: Fetch workspace credentials from Keycloak
    const clientsUrl = `${keycloakUrl}/admin/realms/${keycloakRealm}/clients?clientId=${workspace}`;
    const clientsResponse = await fetch(clientsUrl, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!clientsResponse.ok) {
      return null;
    }

    const clients = await clientsResponse.json();

    if (!clients || clients.length === 0) {
      return null;
    }

    const client = clients[0];
    const attributes = client.attributes || {};

    const clientId = attributes.AUTH_CLIENT_ID || attributes.auth_client_id;
    const clientSecret = attributes.AUTH_CLIENT_SECRET || attributes.auth_client_secret;
    const tokenUrlAttr = attributes.AUTH_TOKEN_URL || attributes.auth_token_url;
    const nervFlowId = attributes.NERV_FLOW_ID || attributes.nerv_flow_id;
    const recurringFlowId = attributes.RECURRING_FLOW_ID || attributes.recurring_flow_id;
    const apiBaseUrl = attributes.FACTORY_API || attributes.factory_api;

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      clientId,
      clientSecret,
      workspace,
      tokenUrl: tokenUrlAttr || 'https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token',
      apiBaseUrl: apiBaseUrl || 'https://api.finarkein.in/factory/v1',
      flowIds: {
        nerv: nervFlowId || '',
        recurring: recurringFlowId || '',
      },
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch credentials from environment variables (fallback)
 */
function fetchCredentialsFromEnv(workspace: string): WorkspaceCredentials {
  // Try workspace-specific env vars first (lowercase workspace name)
  const workspaceLower = workspace.toLowerCase();
  const clientId = process.env[`${workspaceLower}_AUTH_CLIENT_ID`] || process.env.AUTH_CLIENT_ID;
  const clientSecret = process.env[`${workspaceLower}_AUTH_CLIENT_SECRET`] || process.env.AUTH_CLIENT_SECRET;
  const nervFlowId = process.env[`${workspaceLower}_NERV_FLOW_ID`] || process.env['nerv.flow.id'];
  const recurringFlowId = process.env[`${workspaceLower}_RECURRING_FLOW_ID`] || process.env['recurring.nerv.flow.id'];

  if (!clientId || !clientSecret) {
    throw new Error(`Credentials not found for workspace: ${workspace}`);
  }

  return {
    clientId,
    clientSecret,
    workspace,
    tokenUrl: process.env.AUTH_TOKEN_URL || 'https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token',
    apiBaseUrl: process.env.FACTORY_API || 'https://api.finarkein.in/factory/v1',
    flowIds: {
      nerv: nervFlowId || '',
      recurring: recurringFlowId || ''
    }
  };
}

/**
 * Fetch credentials with Keycloak-first approach and env fallback
 */
async function fetchCredentials(workspace: string): Promise<WorkspaceCredentials> {
  // Try Keycloak first (if configured)
  const keycloakCredentials = await fetchCredentialsFromKeycloak(workspace);

  if (keycloakCredentials) {
    return keycloakCredentials;
  }

  // Fallback to environment variables
  return fetchCredentialsFromEnv(workspace);
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/workspace/credentials
 * Returns workspace-specific credentials for the authenticated user
 * Used by Zudoku to fetch credentials for direct API calls
 * Also used by /credentials page to display credentials
 */
app.get('/api/workspace/credentials', async (req, res) => {
  try {
    // Check for workspace in query parameter
    let workspace = req.query.workspace as string;
    
    if (!workspace) {
      // Fallback to default workspace
      workspace = process.env.workspace as string;
    }

    if (!workspace) {
      return res.status(400).json({ error: 'Workspace not configured' });
    }

    // Fetch credentials for this workspace
    const credentials = await fetchCredentials(workspace);

    res.json(credentials);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch workspace credentials',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001);

app.listen(PORT, () => {
});

export default app;
