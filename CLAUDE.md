## Project Overview

Authenticated API documentation site built with Zudoku. Features Keycloak authentication, dynamic credential management (Keycloak or environment variables), and direct API testing with automatic Bearer token injection.

**Key Flow:** User authenticates → Extract workspace → Fetch OAuth2 credentials → Inject tokens → Test APIs

## Development Commands

```bash
# Install dependencies
npm install

# Run development (backend on :3001, frontend on :3000)
npm run dev

# Run backend only
npm run server

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Check for unused dependencies
npm run knip
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

**Required:**
- `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET` - OAuth2 credentials (fallback)
- `AUTH_TOKEN_URL` - Keycloak token endpoint
- `FACTORY_API` - API base URL
- `workspace` - Default workspace name
- `nerv.flow.id`, `recurring.nerv.flow.id` - Flow IDs

**Optional (Production):**
- `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` - For dynamic credential fetching

## Architecture

### Two-Server Setup

1. **Express Backend** (`server.ts`, port 3001)
   - `GET /api/workspace/credentials?workspace=xxx` - Returns OAuth2 credentials
   - Credential resolution: Keycloak → env vars → error
   - CORS configured for frontend origins

2. **Zudoku Frontend** (port 3000)
   - Protected by Clerk authentication
   - API Reference with "Try It" testing
   - Custom `/credentials` page

### Request Flow

```
User clicks "Try It" in docs
  ↓
apiIdentity.ts intercepts request
  ↓
Fetch credentials from backend (/api/workspace/credentials)
  ↓
Get OAuth2 token (cached per workspace, auto-refreshed)
  ↓
Inject Bearer token + replace {workspace}/{flowId} in URL
  ↓
Make authenticated request to actual API
  ↓
Return response to Zudoku UI
```

### Key Files

**Backend:**
- `server.ts` - Express server with credential endpoints
  - `fetchCredentialsFromKeycloak()` - Primary credential source (server.ts:41-119)
  - `fetchCredentialsFromEnv()` - Fallback to environment variables (server.ts:124-147)

**Frontend Core:**
- `zudoku.config.tsx` - Zudoku configuration with Clerk auth and API plugin
- `src/apiIdentity.ts` - Request interceptor for token injection and URL parameter replacement
- `src/CredentialsPage.tsx` - UI for displaying user credentials

**Auth & HTTP:**
- `src/auth/token.ts` - OAuth2 token management with in-memory caching (60s expiry buffer)
- `src/lib/http.ts` - Authenticated fetch wrapper with 401 retry logic

**Utilities:**
- `src/lib/utils.ts` - Shared functions for URL building, workspace extraction, validation
- `src/lib/constants.ts` - HTTP headers constants
- `src/types/credentials.ts` - `WorkspaceCredentials` interface

### Token Management

- **Caching:** In-memory per workspace (not persisted for security)
- **Refresh:** Automatic before expiry (60s buffer)
- **401 Handling:** Clear cache → get new token → retry once

### URL Parameter Replacement

`apiIdentity.ts` automatically replaces:
- `{workspace}` → user's workspace ID
- `{flowId}` → `credentials.flowIds.recurring` (for `/fetch/` endpoints) or `credentials.flowIds.nerv` (others)

## CORS Configuration

Three systems require CORS configuration for "Try It" to work:

### 1. Backend APIs (api.finarkein.in)

Add CORS middleware using the `cors` package:

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://docs.finarkein.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
  maxAge: 86400
}));
```

**Test:** `curl -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" -v https://api.finarkein.in/factory/v1/endpoint`

### 2. Keycloak Token Endpoint (id.finarkein.com)

Configure via Keycloak Admin Console:
1. Login → **Clients** → Your Client → **Settings**
2. Find **Web Origins** field
3. Add (one per line):
   - `http://localhost:3000`
   - `https://docs.finarkein.com`
4. Save

**Test:** `curl -X OPTIONS -H "Origin: http://localhost:3000" -v https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token`

### 3. Docs Backend (server.ts:13-32)

Already configured. Allows localhost:3000 and docs.finarkein.com.

### End-to-End Verification

```bash
# Start dev server
npm run dev

# Open http://localhost:3000 → API Reference → Try any endpoint
# Check DevTools Network tab for:
✓ GET /api/workspace/credentials → 200 OK
✓ POST /token (Keycloak) → 200 OK
✓ GET /factory/v1/... → 200 OK (with Bearer token in headers)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| CORS error on token fetch | Keycloak Web Origins not set | Add origins in Keycloak client settings |
| CORS error on API calls | Backend CORS not configured | Add CORS middleware to backend APIs |
| "Credentials not found" | Missing env vars | Check `.env` has `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` |
| "Token request failed" | Invalid credentials or URL | Verify `AUTH_TOKEN_URL` and credentials with curl |
| 401 on API calls | Token not injected | Check `src/apiIdentity.ts` authorization logic |
| 401 after some time | Token expired, not refreshing | Verify token refresh on 401 in `http.ts:74-80` |
| 403 on API calls | Token valid but wrong permissions | Check Keycloak client roles/scopes |
