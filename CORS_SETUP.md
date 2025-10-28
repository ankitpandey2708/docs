# CORS Setup Guide

## Quick Summary

Three systems need CORS configured:
1. **Your backend APIs** (`api.finarkein.in`) - so docs app can call them
2. **Keycloak token endpoint** (`id.finarkein.com`) - so docs app can get tokens
3. **Docs backend** (`server.ts`) - already configured ✓

---

## 1. Backend API CORS Configuration

Add this middleware to your Express/Node backend APIs:

```javascript
// cors-middleware.js
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://docs.finarkein.com'
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept,X-Requested-With');
    res.header('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
```

### Using cors package (simpler):

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

**Test it:**
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  -v \
  https://api.finarkein.in/factory/v1/your-endpoint

# Should see: Access-Control-Allow-Origin: http://localhost:3000
```

---

## 2. Keycloak Token Endpoint CORS

### Option A: Keycloak Admin Console (easiest)

1. Login: `https://id.finarkein.com/auth/admin`
2. Navigate: **Clients** → `client-tsfsl-03d952d6` → **Settings**
3. Find **Web Origins** field
4. Add (one per line):
   ```
   http://localhost:3000
   https://docs.finarkein.com
   ```
5. Click **Save**

**Test it:**
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type" \
  -v \
  https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token

# Should see: Access-Control-Allow-Origin: http://localhost:3000
```

### Option B: Nginx Proxy (if no Keycloak admin access)

```nginx
location /auth/realms/fin-dev/protocol/openid-connect/token {
    # Preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Methods' 'POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        return 204;
    }

    # Actual request
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    proxy_pass https://keycloak-backend;
}
```

---

## 3. Verify Bearer Token Injection

### Browser DevTools Method

1. Open DevTools (`F12`) → **Network** tab
2. In Zudoku, test any API endpoint (e.g., GET `/account/aggregate-account`)
3. Click the request → **Headers** section
4. Verify:
   ```
   Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**Expected responses:**
- ✅ Token present + valid → `200 OK`
- ❌ Token missing → `401 Unauthorized`
- ❌ Token expired → `401 Unauthorized`

### Console Debugging

Add to `src/apiIdentity.ts` temporarily:

```typescript
authorizeRequest: async (request) => {
  // ... existing code ...

  const token = await getAccessToken(config);
  console.log('🔑 Token:', token.substring(0, 20) + '...');
  console.log('🎯 Request:', request.url);

  // ... rest of code ...
}
```

Check console for:
```
🔑 Token: eyJhbGciOiJSUzI1Ni...
🎯 Request: https://api.finarkein.in/factory/v1/account/...
```

---

## 4. End-to-End Testing

### Local Test

```bash
# 1. Start docs app
npm run dev

# 2. Open browser: http://localhost:3000
# 3. Open DevTools → Network tab
# 4. Navigate to API Reference → Try any endpoint
# 5. Verify network trace:

✓ GET /api/workspace/credentials → 200 OK
✓ POST /token (Keycloak) → 200 OK
✓ GET /factory/v1/... → 200 OK (with Bearer token)
```

### Production Test

```bash
# 1. Build and deploy
npm run build

# 2. Open prod URL: https://docs.finarkein.com
# 3. Same verification steps as local
# 4. Confirm base URLs unchanged:
#    - Token: https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token
#    - API: https://api.finarkein.in/factory/v1/...
```

---

## 5. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| CORS error on token fetch | Keycloak Web Origins not set | Add origins in Keycloak client settings |
| CORS error on API calls | Backend CORS not configured | Add CORS middleware to backend |
| 401 on API calls | Token not injected | Check `src/apiIdentity.ts` authorization logic |
| 401 after some time | Token expired, not refreshing | Verify token refresh on 401 in `lib/http.ts` |
| 403 on API calls | Token valid but wrong permissions | Check Keycloak client roles/scopes |
| Wrong base URL in requests | Proxy still enabled | Verify no rewrites in configs |

### Quick Checks

```bash
# Check if CORS headers present
curl -I -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  https://api.finarkein.in/factory/v1/some-endpoint

# Decode token (paste actual token)
echo "eyJhbGc..." | cut -d'.' -f2 | base64 -d | jq .

# Check token expiry
node -e "console.log(new Date(PAYLOAD.exp * 1000))"
```

---

## Common Mistakes

1. **Not handling OPTIONS preflight** - Always return 204 for OPTIONS requests
2. **Using `Access-Control-Allow-Origin: *` with credentials** - Use specific origins instead
3. **Forgetting to add both localhost:3000 and 127.0.0.1:3000** - Some browsers use different hosts
4. **CDN/WAF stripping CORS headers** - Check if intermediaries remove headers
5. **Not testing token refresh on 401** - Verify retry logic works

---

## Environment Variables Reference

Required in `.env`:

```bash
# Token endpoint
AUTH_TOKEN_URL=https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token

# OAuth credentials
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret

# API base
FACTORY_API=https://api.finarkein.in/factory/v1

# Workspace
workspace=your-workspace-name
nerv.flow.id=your-one-time-flow-id
recurring.nerv.flow.id=your-recurring-flow-id

# CORS (for docs backend)
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://docs.finarkein.com
```

---

## Support Checklist

Before asking for help:

- [ ] Verified CORS headers in response (curl -I or DevTools)
- [ ] Confirmed token obtained successfully (check Network tab)
- [ ] Verified Authorization header sent (check Request Headers)
- [ ] Tested with both localhost:3000 and 127.0.0.1:3000
- [ ] Checked browser console for errors
- [ ] Verified .env variables set correctly
- [ ] Tested OPTIONS preflight separately
