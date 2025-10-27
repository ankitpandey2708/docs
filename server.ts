import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Clerk JWT verification
const client = jwksClient({
  jwksUri: process.env.CLERK_JWKS_URI,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// Middleware to verify Clerk JWT
async function verifyClerkToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        algorithms: ['RS256']
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Fetch credentials from Keycloak (stub for future implementation)
 */
async function fetchFromKeycloak(workspace: string): Promise<WorkspaceCredentials | null> {
  // TODO: Implement Keycloak integration
  // Example:
  // const keycloakClient = new KeycloakAdminClient({...});
  // const client = await keycloakClient.clients.find({ clientId: `client-${workspace}` });
  // return { clientId: client.clientId, clientSecret: client.secret, ... };

  console.log(`Keycloak integration not yet implemented for workspace: ${workspace}`);
  return null;
}

/**
 * Fetch credentials from environment variables (development fallback)
 */
function fetchFromEnv(workspace: string): WorkspaceCredentials {
  const workspaceUpper = workspace.toUpperCase();

  // Try workspace-specific env vars first
  const clientId = process.env[`${workspaceUpper}_AUTH_CLIENT_ID`] || process.env.AUTH_CLIENT_ID;
  const clientSecret = process.env[`${workspaceUpper}_AUTH_CLIENT_SECRET`] || process.env.AUTH_CLIENT_SECRET;
  const nervFlowId = process.env[`${workspaceUpper}_NERV_FLOW_ID`] || process.env['nerv.flow.id'];
  const recurringFlowId = process.env[`${workspaceUpper}_RECURRING_FLOW_ID`] || process.env['recurring.nerv.flow.id'];

  if (!clientId || !clientSecret) {
    throw new Error(`Credentials not found for workspace: ${workspace}`);
  }

  return {
    clientId,
    clientSecret,
    workspace,
    tokenUrl: process.env.AUTH_TOKEN_URL,
    apiBaseUrl: process.env.FACTORY_API,
    flowIds: {
      nerv: nervFlowId || '',
      recurring: recurringFlowId || ''
    }
  };
}

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
 * GET /api/workspace/credentials
 * Returns workspace-specific credentials for the authenticated user
 */
app.get('/api/workspace/credentials', verifyClerkToken, async (req, res) => {
  try {
    const user = (req as any).user;

    // Extract workspace from user's public metadata
    // Clerk stores custom data in publicMetadata
    const workspace = user.publicMetadata?.workspace || user.workspace || process.env.workspace;

    let credentials: WorkspaceCredentials | null = null;

    // Try Keycloak first (if configured)
    if (process.env.KEYCLOAK_URL) {
      console.log('Attempting to fetch from Keycloak...');
      credentials = await fetchFromKeycloak(workspace);
    }

    // Fallback to environment variables
    if (!credentials) {
      console.log('Falling back to environment variables');
      credentials = fetchFromEnv(workspace);
    }

    // Return credentials (excluding sensitive data in logs)
    console.log(`Successfully fetched credentials for workspace: ${credentials.workspace}`);

    res.json(credentials);
  } catch (error) {
    console.error('Error fetching workspace credentials:', error);
    res.status(500).json({
      error: 'Failed to fetch workspace credentials',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    keycloakConfigured: !!process.env.KEYCLOAK_URL
  });
});

/**
 * POST /api/token/exchange
 * Exchange client credentials for access token
 * This endpoint can be used by the frontend to get tokens without exposing client_secret
 */
app.post('/api/token/exchange', verifyClerkToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const workspace = user.publicMetadata?.workspace || user.workspace || process.env.workspace;
    
    let credentials: WorkspaceCredentials | null = null;
    if (process.env.KEYCLOAK_URL) {
      credentials = await fetchFromKeycloak(workspace);
    }
    if (!credentials) {
      credentials = fetchFromEnv(workspace);
    }

    // Exchange for token
    const tokenResponse = await fetch(credentials.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();

    res.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      workspace: credentials.workspace,
      flowIds: credentials.flowIds
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({
      error: 'Token exchange failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


app.listen(process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001), () => {
  console.log(`🔐 Keycloak: ${process.env.KEYCLOAK_URL ? 'Configured ✅' : 'Not configured (using .env fallback)'}`);
});

export default app;
