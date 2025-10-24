import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();


const app = express();

// Allow multiple CORS origins for development and production
const allowedOrigins = [
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['set-cookie']
}));
app.use(express.json());

// Root route for health check
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Zudoku Backend API is running',
    version: '1.0.0',
    endpoints: {
      '/api/zippopotam': 'Zip code lookup service (basic access required)',
      '/api/httpbin': 'HTTP testing service (paid access required)',
      '/api/unsplash': 'Unsplash photo API (paid access required)'
    }
  });
});

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  user?: {
    role: string;
    email: string;
  };
}

// Clerk JWKS client for JWT verification
const client = jwksClient({
  jwksUri: process.env.CLERK_JWKS_URI as string
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  client.getSigningKey(header.kid, function (err, key) {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// Extract and verify session token from Authorization header or cookie (Clerk session)
async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  // First, try to get token from Authorization header (for cross-origin requests)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  // Fall back to cookie if no Authorization header (for same-origin/local development)
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc: Record<string, string>, cookie: string) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});

    token = cookies['__session'];
  }

  // Check if token exists
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No authentication token provided' });
    return;
  }

  // Verify and decode the session token
  jwt.verify(token as string, getKey, { algorithms: ['RS256'] }, async (err, decoded) => {
    if (err) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
      return;
    }
    
    const decodedPayload = decoded as jwt.JwtPayload & { role?: string; email?: string };
        
    // If shortcodes aren't replaced, fetch user data from Clerk API
    if (decodedPayload.role && decodedPayload.role.includes('{{')) {      
      try {
        const userId = decodedPayload.sub;
        const clerkResponse = await fetch(
          `https://api.clerk.com/v1/users/${userId}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (clerkResponse.ok) {
          const userData = await clerkResponse.json() as {
            public_metadata?: { role?: string };
            email_addresses?: Array<{ email_address?: string }>;
          };
          req.user = {
            role: userData.public_metadata?.role || 'basic',
            email: userData.email_addresses?.[0]?.email_address
          };
        }
      } catch (apiError) {
        // Error handling removed as requested
      }
    } else {
      // Shortcodes were replaced correctly
      req.user = {
        role: decodedPayload.role ,
        email: decodedPayload.email
      };
    }

    next();
  });
}

// Get domain from email
function getDomainFromEmail(email: string): string | null {
  if (!email) return null;
  const fullDomain = email.split('@')[1];
  return fullDomain ? fullDomain.split('.')[0] : null;
}

// Get API keys for user based on domain
function getUserSecrets(email: string): Record<string, string | undefined> {  
  const domain = getDomainFromEmail(email);

  const secrets = {
    unsplash: process.env[`${domain}_UNSPLASH_KEY`]
  };

  return secrets;
}

// Check if user has access to the API based on role
function checkApiAccess(apiPath: string, requiredRole: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    // Block if required role is paid and user doesn't have paid role
    if (requiredRole === 'paid' && userRole !== 'paid') {
      res.status(403).json({ 
        error: 'Upgrade required',
        message: 'This API requires a paid subscription. Please upgrade your account.'
      });
      return;
    }

    next();
  };
}

// Set CORS headers on proxy responses
function setCorsHeaders(proxyRes: any): void {
  proxyRes.headers['access-control-allow-origin'] = process.env.FRONTEND_URL;
  proxyRes.headers['access-control-allow-credentials'] = 'true';
}

// Helper function to create proxy middleware with common configuration
interface ProxyConfig {
  target: string;
  apiPath: string;
  onProxyReq?: (proxyReq: any, req: any) => void;
}

function createApiProxy(config: ProxyConfig) {
  const { target, apiPath, onProxyReq } = config;
  
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      [`^${apiPath}`]: ''
    },
    onProxyReq,
    onProxyRes: setCorsHeaders
  });
}

// Helper function to register an API route with authentication and proxying
interface ApiRouteConfig {
  path: string;
  target: string;
  role: 'basic' | 'paid';
  beforeProxy?: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
  onProxyReq?: (proxyReq: any, req: any) => void;
}

function registerApiRoute(config: ApiRouteConfig) {
  const { path, target, role, beforeProxy, onProxyReq } = config;
  
  const middlewares = [
    authenticateToken,
    checkApiAccess(path, role)
  ];
  
  if (beforeProxy) {
    middlewares.push(beforeProxy);
  }
  
  middlewares.push(createApiProxy({ target, apiPath: path, onProxyReq }));
  
  app.use(path, ...middlewares);
}

// API Routes Configuration
registerApiRoute({
  path: '/api/zippopotam',
  target: 'http://api.zippopotam.us',
  role: 'basic'
});

registerApiRoute({
  path: '/api/httpbin',
  target: 'https://httpbin.org',
  role: 'paid'
});

registerApiRoute({
  path: '/api/unsplash',
  target: 'https://api.unsplash.com',
  role: 'paid',
  beforeProxy: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const secrets = getUserSecrets(req.user?.email || '');
    
    if (!secrets.unsplash) {
      res.status(500).json({ error: 'API key not configured for your domain' });
      return;
    }

    next();
  },
  onProxyReq: (proxyReq, req) => {
    const authReq = req as AuthenticatedRequest;
    const secrets = getUserSecrets(authReq.user?.email || '');
    proxyReq.setHeader('Authorization', `Client-ID ${secrets.unsplash}`);
  }
});

app.listen(process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001), () => {});
