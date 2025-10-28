import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

dotenv.config();

const app = express();

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://docs.finarkein.com'
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
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clerk JWT verification
const client = jwksClient({
  jwksUri: process.env.CLERK_JWKS_URI!,
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
 * Fetch credentials from environment variables
 */
function fetchCredentials(workspace: string): WorkspaceCredentials {
  // Try workspace-specific env vars first
  const clientId = process.env[`${workspace}_AUTH_CLIENT_ID`] || process.env.AUTH_CLIENT_ID;
  const clientSecret = process.env[`${workspace}_AUTH_CLIENT_SECRET`] || process.env.AUTH_CLIENT_SECRET;
  const nervFlowId = process.env[`${workspace}_NERV_FLOW_ID`] || process.env['nerv.flow.id'];
  const recurringFlowId = process.env[`${workspace}_RECURRING_FLOW_ID`] || process.env['recurring.nerv.flow.id'];

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

// Cache for bearer tokens (keyed by workspace)
const tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

/**
 * Get or refresh bearer token for a workspace
 */
async function getBearerToken(credentials: WorkspaceCredentials): Promise<string> {
  const cached = tokenCache.get(credentials.workspace);
  
  // Check if we have a valid cached token (with 60 second buffer)
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  // Fetch new token
  console.log(`🔄 Fetching new token for workspace: ${credentials.workspace}`);
  
  const tokenResponse = await fetch(credentials.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token fetch failed:', tokenResponse.status, errorText);
    throw new Error(`Token fetch failed: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  
  // Cache the token
  tokenCache.set(credentials.workspace, {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in * 1000)
  });

  return tokenData.access_token;
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
 * Used by MyApiKeyService to display credentials in Settings > API Keys
 * Also used by custom Credentials page (falls back to default workspace if no auth)
 */
app.get('/api/workspace/credentials', async (req, res) => {
  try {
    // Try to verify Clerk token if provided, otherwise use default workspace
    let workspace = process.env.workspace; // Default workspace
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = await new Promise((resolve, reject) => {
          jwt.verify(token, getKey, {
            algorithms: ['RS256']
          }, (err, decoded: any) => {
            if (err) reject(err);
            else resolve(decoded);
          });
        });
        
        const user = decoded as any;
        workspace = user.publicMetadata?.workspace || user.workspace || workspace;
        console.log('✓ Authenticated request, using workspace:', workspace);
      } catch (error) {
        console.log('Token verification failed, using default workspace:', workspace);
      }
    } else {
      console.log('No auth token provided, using default workspace:', workspace);
    }

    if (!workspace) {
      return res.status(400).json({ error: 'Workspace not configured' });
    }

    // Fetch credentials for this workspace
    const credentials = fetchCredentials(workspace);

    console.log(`✓ Successfully fetched credentials for workspace: ${credentials.workspace}`);

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
 * Universal API proxy middleware
 * Proxies all /api/* requests to Finarkein API with automatic authentication
 */
app.all('/api/*', verifyClerkToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const workspace = user.publicMetadata?.workspace || user.workspace || process.env.workspace;

    if (!workspace) {
      return res.status(400).json({ error: 'Workspace not configured for user' });
    }

    // Fetch credentials for this workspace
    const credentials = fetchCredentials(workspace);

    // Extract the actual API path (remove /api prefix)
    let apiPath = req.path.replace(/^\/api/, '');
    
    // Auto-fill path parameters
    apiPath = apiPath.replace(/\{workspace\}/g, credentials.workspace);
    
    // Replace flowId based on the endpoint
    if (apiPath.includes('{flowId}')) {
      const flowId = apiPath.includes('/fetch/') 
        ? credentials.flowIds.recurring 
        : credentials.flowIds.nerv;
      apiPath = apiPath.replace(/\{flowId\}/g, flowId);
    }

    // Determine target URL and auth
    let targetUrl: string;
    let authHeader: string;
    let requestBody: string | undefined;

    if (apiPath === '/token' || apiPath.endsWith('/token')) {
      // For /token endpoint, use Keycloak and Basic Auth
      targetUrl = credentials.tokenUrl;
      authHeader = `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`;
      
      // Always send grant_type=client_credentials for token endpoint
      requestBody = 'grant_type=client_credentials';
    } else {
      // For all other endpoints, use Factory API and Bearer token
      const bearerToken = await getBearerToken(credentials);
      targetUrl = `${credentials.apiBaseUrl}${apiPath}`;
      authHeader = `Bearer ${bearerToken}`;
      
      // Include body for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          requestBody = new URLSearchParams(req.body).toString();
        } else {
          requestBody = JSON.stringify(req.body);
        }
      }
    }

    // Make the proxied request
    const proxyHeaders: any = {
      'Authorization': authHeader,
      'Content-Type': apiPath.includes('/token') 
        ? 'application/x-www-form-urlencoded'
        : (req.headers['content-type'] || 'application/json'),
    };

    // Forward other relevant headers
    if (req.headers['user-agent']) {
      proxyHeaders['User-Agent'] = req.headers['user-agent'];
    }

    const proxyOptions: any = {
      method: req.method,
      headers: proxyHeaders,
    };

    // Add body if present
    if (requestBody) {
      proxyOptions.body = requestBody;
    }

    console.log(`🔄 Proxying ${req.method} ${apiPath} -> ${targetUrl}`);

    const response = await fetch(targetUrl, proxyOptions);
    
    // Forward response status
    res.status(response.status);

    // Forward response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Forward response body
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001);

app.listen(PORT, () => {
  console.log(`🚀 Finarkein API Proxy running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
});

export default app;
