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

**Endpoint:**
- `GET /api/workspace/credentials?workspace=xxx` - Returns OAuth2 credentials

**Resolution:** Keycloak → env vars → return credentials

### `src/lib/http.ts` - Authenticated Fetch

Wraps `fetch()` with automatic Bearer token injection.

```typescript
import { authenticatedFetch } from './lib/http';

const response = await authenticatedFetch(
  'https://api.example.com/endpoint',
  { method: 'GET' },
  'my-workspace'
);
```

On 401: clears token → gets new token → retries once.

### `src/auth/token.ts` - Token Management

OAuth2 Client Credentials flow with in-memory caching.

```typescript
const token = await getAccessToken({
  tokenUrl: 'https://id.example.com/token',
  clientId: 'client-123',
  clientSecret: 'secret-456',
  workspace: 'my-workspace'
});
```

Caches tokens per workspace. Auto-refreshes before expiry (60s buffer).

### `src/apiIdentity.ts` - Request Interceptor

Intercepts "Try It" requests, injects Bearer tokens, replaces `{workspace}` and `{flowId}` in URLs.

### `src/CredentialsPage.tsx` - Credentials UI

Displays user's credentials (masked). Auto-fetches on mount based on Clerk auth.

### `src/lib/utils.ts` - Shared Utilities

- `getBackendUrl()` - Backend URL
- `buildCredentialsUrl(workspace?)` - Credentials endpoint URL
- `extractWorkspace(authContext)` - Extract workspace from Clerk
- `validateResponse(response, message)` - Throw on non-2xx

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

## Authentication Flow

**User Auth:** `User → Clerk Login → Auth cookies → Docs access`

**Credentials:** `Extract workspace → GET /api/workspace/credentials → Keycloak/env → Return JSON`

**API Request:** `"Try It" → Intercept → Get token → Inject Bearer → Call API → Response`

## CORS Configuration

Three systems need CORS configured for "Try It" to work:

### 1. Backend APIs (api.finarkein.in)

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://docs.finarkein.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));
```

**Test:**
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  https://api.finarkein.in/factory/v1/endpoint
```

### 2. Keycloak Token Endpoint (id.finarkein.com)

**Keycloak Admin Console:**
1. Login → **Clients** → Your Client → **Settings**
2. Find **Web Origins** field
3. Add:
   ```
   http://localhost:3000
   https://docs.finarkein.com
   ```
4. Save

**Test:**
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token
```

### 3. Docs Backend (server.ts)

Already configured in `server.ts` lines 13-32.

### CORS Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS error on token fetch | Add origins in Keycloak client Web Origins |
| CORS error on API calls | Add CORS middleware to backend APIs |
| 401 on API calls | Check token injection in `apiIdentity.ts` |
| 401 after some time | Verify token refresh on 401 in `http.ts` |

**Quick Check:**
```bash
# Verify CORS headers present
curl -I -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  https://api.finarkein.in/factory/v1/endpoint
```

## Adding New Features

### Add Utility

```typescript
// src/lib/utils.ts
export function myUtility(param: string): string {
  return `processed-${param}`;
}
```

### Add Component

```typescript
// src/components/MyComponent.tsx
export const MyComponent: React.FC<{data: string}> = ({ data }) => (
  <div>{data}</div>
);
```

### Add Page

```tsx
// zudoku.config.tsx
import { MyPage } from './src/MyPage.js';

navigation: [
  {
    type: "custom-page",
    path: "/my-page",
    label: "My Page",
    element: <MyPage />,
  }
]
```

## Development

### Setup

```bash
npm install
```

### Run

```bash
npm run dev  # Runs backend (3001) + frontend (3000)
```

### Environment Variables

```bash
# Required
NODE_ENV=development
PORT=3001

# Keycloak (optional)
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=admin-cli
KEYCLOAK_CLIENT_SECRET=secret

# Fallback (required if no Keycloak)
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

### Check API Flow

Open DevTools → Network → Click "Try It" → Verify:
1. Request to `/api/workspace/credentials` → 200
2. Request to token URL → 200 (if not cached)
3. Request to API with `Authorization: Bearer <token>` → 200

### Common Issues

| Issue | Fix |
|-------|-----|
| "Credentials not found" | Check `.env` has `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` |
| "Token request failed" | Verify `AUTH_TOKEN_URL` and credentials are valid |
| Circular dependency | Ensure `token.ts` imports from `utils`, not `http` |
| CORS errors | Check origins in `server.ts` and backend APIs |

## Deployment

### Vercel

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".zudoku/dist"
}
```

Set env vars in Vercel dashboard (same as dev, but production URLs).

## Performance

**Token Caching:** Tokens cached in memory per workspace. Expire 60s before actual expiry.

**Credentials:** Fetched once per page load. Not cached in localStorage (security).

## Security

- No credentials in browser storage (memory only)
- No token logging
- CORS restricted to specific origins
- All routes protected by Clerk
- Workspace isolation

## Testing API Manually

```bash
# 1. Get credentials
CREDS=$(curl -s "http://localhost:3001/api/workspace/credentials?workspace=test")

# 2. Get token
TOKEN=$(curl -s -X POST "$(echo $CREDS | jq -r '.tokenUrl')" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "$(echo $CREDS | jq -r '.clientId'):$(echo $CREDS | jq -r '.clientSecret')" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# 3. Call API
curl "$(echo $CREDS | jq -r '.apiBaseUrl')/endpoint" \
  -H "Authorization: Bearer $TOKEN"
```

## Recent Changes

### 2024-10-28
- Removed unused exports and code duplication (~30-40% reduction)
- Fixed circular dependency between `http.ts` and `token.ts`
- Added shared utilities, types, constants
- Added `CredentialField` component

---

**Last Updated**: 2024-10-28
**Version**: 0.1.0
