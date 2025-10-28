# Universal Proxy Implementation

## Overview

This implementation uses a **universal proxy pattern** where ALL API requests from Zudoku go through the backend server, which handles authentication, credential management, and proxying to the Finarkein API.

## Architecture

```
Browser/Zudoku → Backend Proxy → Finarkein API
                 (localhost:3001)
```

### Request Flow

1. **User authenticates** with Clerk in Zudoku
2. **API request initiated** from Zudoku Try-It console
3. **Clerk JWT sent** to backend proxy via Authorization header
4. **Backend validates** Clerk JWT
5. **Backend extracts** workspace from user metadata
6. **Backend fetches** workspace credentials from environment
7. **Backend determines** authentication method:
   - `/token` endpoint → Basic Auth to Keycloak
   - All other endpoints → Bearer token to Factory API
8. **Backend proxies** request with proper authentication
9. **Response forwarded** back to Zudoku

## Key Components

### 1. OpenAPI Template (`openapi.template.yaml`)

- Contains `${BACKEND_URL}` placeholder
- Single server configuration pointing to proxy
- All endpoints require `bearerAuth` (handled by proxy)

### 2. Build Script (`scripts/manage-openapi.ts`)

- Runs automatically before `dev` and `build` commands
- Replaces `${BACKEND_URL}` with appropriate value:
  - Development: `http://localhost:3001`
  - Production: `https://docs.finarkein.com`
- Generates `openapi.yaml` (gitignored)

### 3. Backend Server (`server.ts`)

**Key Features:**
- Validates Clerk JWT on all `/api/*` requests
- Extracts workspace from user metadata
- Fetches credentials from environment variables
- Implements token caching for efficiency
- Auto-fills path parameters (`{workspace}`, `{flowId}`)
- Routes `/token` to Keycloak with Basic Auth
- Routes other endpoints to Factory API with Bearer token

**Endpoints:**
- `/api/health` - Health check
- `/api/*` - Universal proxy for all Finarkein API calls

### 4. Zudoku Config (`zudoku.config.tsx`)

**Simplified to:**
- Single identity: "Workspace Authentication"
- Simply passes Clerk token to proxy
- No complex credential fetching
- No dual identity management

## Benefits

### ✅ Security
- Client secrets NEVER exposed to browser
- All credentials managed server-side
- Clerk JWT validates every request

### ✅ No CORS Issues
- All requests go through same domain
- No cross-origin restrictions
- Works in development and production

### ✅ Automatic Authentication
- Proxy handles token exchange
- Token caching for performance
- Auto-fills workspace-specific parameters

### ✅ Simplified Frontend
- Single identity in Zudoku
- No complex authorization logic
- Clean separation of concerns

### ✅ Environment Flexibility
- Same code works in dev and production
- Environment-specific configuration via template
- Easy to deploy and maintain

## Environment Variables

Required in `.env`:

```env
# Clerk Configuration
CLERK_JWKS_URI=https://open-bluejay-30.clerk.accounts.dev/.well-known/jwks.json

# Finarkein API Configuration
AUTH_CLIENT_ID=client-tsfsl-03d952d6
AUTH_CLIENT_SECRET=your-secret-here
AUTH_TOKEN_URL=https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token
FACTORY_API=https://api.finarkein.in/factory/v1

# Flow IDs
nerv.flow.id=376b71fe-009b-4154-850c-fa0eb65b4d5a
recurring.nerv.flow.id=your-recurring-flow-id

# Workspace (fallback if not in user metadata)
workspace=tsfsl

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Optional: Backend URL override
ZUDOKU_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Development Workflow

1. **Start development:**
   ```bash
   npm run dev
   ```
   This automatically:
   - Runs `manage-openapi.ts` (generates openapi.yaml)
   - Starts backend server on port 3001
   - Starts Zudoku on port 3000

2. **Test API endpoints:**
   - Navigate to API Reference in Zudoku
   - Click "Authorize" and select "Workspace Authentication"
   - Try any endpoint - authentication is automatic

## Production Deployment

1. **Set environment variable:**
   ```env
   ZUDOKU_PUBLIC_BACKEND_URL=https://docs.finarkein.com
   NODE_ENV=production
   ```

2. **Build:**
   ```bash
   npm run build
   ```
   This automatically runs `manage-openapi.ts` with production URL

3. **Deploy:**
   - Deploy frontend (Zudoku static files) to CDN/hosting
   - Deploy backend server to same domain or subdomain
   - Ensure `/api/*` routes to backend server

## Troubleshooting

### Issue: 401 Unauthorized
- Check Clerk token is being sent
- Verify `CLERK_JWKS_URI` is correct
- Ensure user has workspace in metadata

### Issue: 400 Bad Request
- Check workspace credentials in `.env`
- Verify `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET`
- Ensure workspace matches user metadata

### Issue: Backend not proxying
- Check backend server is running on correct port
- Verify `ZUDOKU_PUBLIC_BACKEND_URL` matches server URL
- Check CORS configuration in `server.ts`

### Issue: Path parameters not filled
- Verify credentials have `flowIds` defined
- Check workspace extraction from user metadata
- Review backend logs for parameter replacement

## Comparison with Previous Implementation

| Aspect | Previous | New (Universal Proxy) |
|--------|----------|----------------------|
| CORS | Required Keycloak config | No CORS issues |
| Frontend Complexity | Dual identities, token exchange | Single identity |
| Security | Client secrets in browser requests | Server-side only |
| Authentication | Frontend manages tokens | Backend handles all auth |
| Path Parameters | Manual in Zudoku | Auto-filled by proxy |
| Environment Switching | Complex dual-server config | Simple template replacement |
| Deployment | Different code paths | Same code, different config |

## Files Modified

- ✅ `openapi.template.yaml` - New template with placeholder
- ✅ `scripts/manage-openapi.ts` - New build script
- ✅ `server.ts` - Complete rewrite with proxy pattern
- ✅ `zudoku.config.tsx` - Simplified single identity
- ✅ `package.json` - Added pre-scripts
- ✅ `.gitignore` - Added generated openapi.yaml

## Next Steps

1. Test the implementation:
   ```bash
   npm run dev
   ```

2. Verify all endpoints work in Zudoku Try-It console

3. Deploy to production and verify with production URL

4. Monitor backend logs for any issues

## Support

For issues or questions, review:
- Backend logs for proxy errors
- Browser console for Zudoku errors
- Network tab to inspect requests/responses
