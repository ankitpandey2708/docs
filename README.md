# Finarkein API Documentation

An authenticated API documentation site built with Zudoku. Users log in via Clerk, get workspace-specific credentials from Keycloak or env vars, and can test API endpoints directly in the browser with automatic Bearer token injection.

## What This Does

- **Authentication**: Clerk protects all routes. Users must log in to see docs.
- **Workspace Credentials**: Backend fetches OAuth2 credentials from Keycloak (or falls back to env vars) based on user's workspace.
- **API Testing**: Users can test API endpoints directly in the docs. Bearer tokens are injected automatically.
- **Credentials Page**: Shows users their OAuth2 credentials and flow IDs in a secure UI.

## Architecture

```
┌─────────────┐
│   Browser   │
│  (Clerk UI) │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Zudoku Frontend (Port 3000)            │
│  - Protected by Clerk auth              │
│  - API Reference with "Try It" feature  │
│  - Custom /credentials page             │
└──────┬──────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Express Backend (Port 3001)            │
│  - GET /api/workspace/credentials       │
│  - Fetches from Keycloak or env vars    │
└──────┬──────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Keycloak (Optional)                    │
│  - Stores workspace credentials         │
│  - Client attributes contain OAuth2 info│
└─────────────────────────────────────────┘
```

## Project Structure

```
.
├── server.ts                         # Express backend for credential fetching
├── zudoku.config.tsx                 # Zudoku configuration
├── openapi.yaml                      # API specification
├── pages/
│   └── introduction.mdx              # Documentation pages
├── src/
│   ├── types/
│   │   └── credentials.ts            # Shared type: WorkspaceCredentials
│   ├── lib/
│   │   ├── http.ts                   # Authenticated fetch with token injection
│   │   ├── utils.ts                  # Shared utilities (URL building, validation)
│   │   └── constants.ts              # HTTP headers constants
│   ├── auth/
│   │   └── token.ts                  # OAuth2 token management with caching
│   ├── components/
│   │   └── CredentialField.tsx       # Reusable component for displaying secrets
│   ├── CredentialsPage.tsx           # Custom page showing user credentials
│   └── apiIdentity.ts                # API request interceptor for token injection
└── package.json
```

## Key Files Explained

### `server.ts` - Backend Credential Server

Express server that fetches workspace credentials.

**Endpoints:**
- `GET /api/workspace/credentials?workspace=xxx` - Returns OAuth2 credentials

**Credential Resolution Flow:**
1. Try Keycloak first (if configured)
2. Fall back to environment variables
3. Return `WorkspaceCredentials` object

**Environment Variables:**
```bash
# Keycloak (optional)
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=admin-cli
KEYCLOAK_CLIENT_SECRET=secret

# Fallback credentials (required if no Keycloak)
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-secret
AUTH_TOKEN_URL=https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token
FACTORY_API=https://api.finarkein.in/factory/v1
nerv.flow.id=flow-123
recurring.nerv.flow.id=flow-456

# Workspace-specific (optional)
workspace_AUTH_CLIENT_ID=workspace-specific-id
workspace_AUTH_CLIENT_SECRET=workspace-specific-secret
```

### `src/lib/http.ts` - Authenticated Fetch

Wraps `fetch()` with automatic Bearer token injection and retry logic.

**Usage:**
```typescript
import { authenticatedFetch } from './lib/http';

// Fetch with auto token injection
const response = await authenticatedFetch(
  'https://api.example.com/endpoint',
  { method: 'GET' },
  'my-workspace' // or WorkspaceCredentials object
);

// On 401, automatically:
// 1. Clears cached token
// 2. Gets new token
// 3. Retries request once
```

**How it works:**
1. Fetches credentials (if workspace string provided)
2. Gets/refreshes OAuth2 token via `getAccessToken()`
3. Injects `Authorization: Bearer <token>` header
4. Handles 401 with automatic retry

### `src/auth/token.ts` - Token Management

OAuth2 Client Credentials flow with in-memory caching.

**Usage:**
```typescript
import { getAccessToken } from './auth/token';

const token = await getAccessToken({
  tokenUrl: 'https://id.example.com/token',
  clientId: 'client-123',
  clientSecret: 'secret-456',
  workspace: 'my-workspace'
});
```

**Features:**
- Caches tokens per workspace
- Auto-refreshes before expiry (60s buffer)
- Uses HTTP Basic Auth
- Thread-safe (Map-based cache)

### `src/apiIdentity.ts` - Request Interceptor

Zudoku plugin that intercepts "Try It" requests and injects Bearer tokens.

**Flow:**
1. User clicks "Try It" in API Reference
2. `authorizeRequest()` is called
3. Fetches credentials for user's workspace
4. Replaces `{workspace}` and `{flowId}` in URL
5. Calls `authenticatedFetch()` to inject token
6. Returns response to Zudoku UI

**Path Parameter Replacement:**
- `{workspace}` → User's workspace ID
- `{flowId}` → `nerv` flow ID (default) or `recurring` flow ID (for `/fetch/` endpoints)

### `src/CredentialsPage.tsx` - Credentials UI

Custom page that displays user's credentials.

**Features:**
- Shows Client ID, Client Secret (masked)
- Shows Flow IDs (masked)
- Shows Token URL and API Base URL
- Auto-fetches on mount based on Clerk auth context

**Data Flow:**
```typescript
useAuth() → extract workspace → fetch /api/workspace/credentials → display
```

### `src/lib/utils.ts` - Shared Utilities

**Functions:**
- `getBackendUrl()` - Returns backend URL (localhost:3001 or current origin)
- `buildCredentialsUrl(workspace?)` - Builds credentials endpoint URL
- `extractWorkspace(authContext)` - Extracts workspace from Clerk auth
- `getAttributeValue(attrs, upper, lower)` - Case-insensitive attribute getter
- `validateResponse(response, message)` - Throws on non-2xx responses

### `src/types/credentials.ts` - Shared Types

```typescript
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
```

Used everywhere: server, frontend, token management.

## Authentication Flow

### 1. User Authentication (Clerk)

```
User → Clerk Login → Clerk sets auth cookies → User sees docs
```

All routes protected by `protectedRoutes: ["/*"]` in `zudoku.config.tsx`.

### 2. Credential Fetching

```
Frontend extracts workspace from Clerk auth.providerData.user.publicMetadata.workspace
         ↓
GET /api/workspace/credentials?workspace=xxx
         ↓
Backend tries Keycloak → Falls back to env vars
         ↓
Returns WorkspaceCredentials JSON
```

### 3. API Request (Try It)

```
User clicks "Try It" in API Reference
         ↓
apiIdentity.authorizeRequest() intercepts
         ↓
Fetch credentials → Get/refresh token → Inject Bearer header
         ↓
Make actual API request → Return response to Zudoku
```

## Adding New Features

### Add a New Shared Utility

```typescript
// src/lib/utils.ts
export function myNewUtility(param: string): string {
  return `processed-${param}`;
}
```

### Add a New Component

```typescript
// src/components/MyComponent.tsx
interface MyComponentProps {
  data: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({ data }) => (
  <div>{data}</div>
);
```

### Add a New API Endpoint (Backend)

```typescript
// server.ts
app.get('/api/my-endpoint', async (req, res) => {
  try {
    const result = await someOperation();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Operation failed' });
  }
});
```

### Add a New Page

```tsx
// zudoku.config.tsx
import { MyPage } from './src/MyPage.js';

navigation: [
  {
    type: "custom-page",
    path: "/my-page",
    label: "My Page",
    icon: "star",
    element: <MyPage />,
  }
]
```

## Development

### Setup

```bash
npm install
```

### Run Development

```bash
npm run dev
# Runs both Express backend (3001) and Zudoku frontend (3000)
```

### Build

```bash
npm run build
```

### Environment Variables

Create `.env` file:

```bash
# Required
NODE_ENV=development
PORT=3001

# Optional: Keycloak
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=admin-cli
KEYCLOAK_CLIENT_SECRET=admin-secret

# Fallback credentials (required if no Keycloak)
AUTH_CLIENT_ID=client-id
AUTH_CLIENT_SECRET=client-secret
AUTH_TOKEN_URL=https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token
FACTORY_API=https://api.finarkein.in/factory/v1
nerv.flow.id=flow-123
recurring.nerv.flow.id=flow-456
```

## Debugging

### Check Credentials Endpoint

```bash
curl http://localhost:3001/api/workspace/credentials?workspace=test
```

Should return JSON with `clientId`, `clientSecret`, `tokenUrl`, etc.

### Check Token Retrieval

```typescript
// In browser console (on /credentials page)
const { getAccessToken } = await import('./src/auth/token.js');
const token = await getAccessToken({
  tokenUrl: 'https://id.example.com/token',
  clientId: 'test',
  clientSecret: 'test',
  workspace: 'test'
});
console.log(token);
```

### Check API Request Flow

Open browser DevTools → Network tab → Click "Try It" on any API endpoint → Check:
1. Request to `/api/workspace/credentials`
2. Request to token URL (if not cached)
3. Request to actual API with `Authorization: Bearer <token>` header

### Common Issues

**Issue**: "Credentials not found"
- **Fix**: Check `.env` file has `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET`

**Issue**: "Failed to fetch credentials" (401/403)
- **Fix**: Check Keycloak credentials or verify env vars are loaded

**Issue**: "Token request failed"
- **Fix**: Check `AUTH_TOKEN_URL` is correct and client credentials are valid

**Issue**: Circular dependency errors
- **Fix**: Ensure imports follow this pattern:
  - `utils.ts` → no internal imports (base utilities)
  - `constants.ts` → no internal imports
  - `http.ts` → `utils`, `constants`, `token`
  - `token.ts` → `utils`, `constants` (NOT http)

**Issue**: CORS errors on API requests
- **Fix**: Check `allowedOrigins` in `server.ts` includes your frontend URL

## Code Conventions

### Imports

- **Shared types**: Import from `src/types/`
- **Utilities**: Import from `src/lib/utils`
- **Constants**: Import from `src/lib/constants`
- **Components**: Import from `src/components/`

### File Extensions

- Use `.js` extension in imports (for ESM compatibility)
- TypeScript will resolve `.ts`/`.tsx` files automatically

### Error Handling

Always use `validateResponse()` for fetch calls:

```typescript
import { validateResponse } from './lib/utils';

const response = await fetch(url);
await validateResponse(response, 'Operation failed');
const data = await response.json();
```

### Token Management

Never call token endpoints directly. Always use `getAccessToken()`:

```typescript
// ❌ Don't do this
const response = await fetch(tokenUrl, { ... });

// ✅ Do this
const token = await getAccessToken(config);
```

## Deployment

### Vercel (Recommended)

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".zudoku/dist",
  "installCommand": "npm install"
}
```

Set environment variables in Vercel dashboard.

### Environment Variables (Production)

Same as development, but use production URLs:
- `KEYCLOAK_URL` → Production Keycloak
- `AUTH_TOKEN_URL` → Production token endpoint
- `FACTORY_API` → Production API base URL

## Performance

### Token Caching

Tokens are cached in memory per workspace. Cache expires 60 seconds before actual token expiry.

**Cache hits** (no network call):
```typescript
getAccessToken(config) // First call: fetches token
getAccessToken(config) // Second call: returns cached token
```

**Cache misses** (network call):
- Token expired or near expiry
- `clearCachedToken(workspace)` called (after 401)
- Different workspace

### Credentials Fetching

Credentials are fetched once per page load. Not cached in localStorage for security.

## Security Notes

- **No credentials in browser storage**: All credentials stay in memory only
- **No token logging**: Tokens never logged to console
- **CORS restricted**: Backend only allows specific origins
- **Clerk authentication**: All routes protected by default
- **Workspace isolation**: Each workspace gets different credentials

## Testing API Calls Manually

```bash
# 1. Get credentials
WORKSPACE="your-workspace"
CREDS=$(curl -s "http://localhost:3001/api/workspace/credentials?workspace=$WORKSPACE")

CLIENT_ID=$(echo $CREDS | jq -r '.clientId')
CLIENT_SECRET=$(echo $CREDS | jq -r '.clientSecret')
TOKEN_URL=$(echo $CREDS | jq -r '.tokenUrl')
API_BASE=$(echo $CREDS | jq -r '.apiBaseUrl')

# 2. Get token
TOKEN=$(curl -s -X POST "$TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# 3. Make API request
curl -X GET "$API_BASE/endpoint" \
  -H "Authorization: Bearer $TOKEN"
```

## Recent Changes

### 2024-10-28: Code Refactoring
- Removed unused exports (`authenticatedGet`, `authenticatedPost`, `clearAllTokens`)
- Eliminated code duplication (~30-40% reduction)
- Created shared utilities, types, and constants
- Fixed circular dependency between `http.ts` and `token.ts`
- Added `CredentialField` component for reusable UI

## Support

For issues or questions, check:
1. This README
2. Browser DevTools console
3. Backend logs (`npm run server`)
4. Network tab for failed requests

---

**Last Updated**: 2024-10-28
**Version**: 0.1.0
