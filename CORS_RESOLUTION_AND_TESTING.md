# CORS Resolution and Bearer Token Testing Guide

## 1. Solving CORS When Hitting Token API

### Problem Overview
The token endpoint `https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token` is blocking requests from the Zudoku documentation site due to missing CORS headers.

### Solution: Configure CORS on Keycloak

#### Option A: Keycloak Admin Console (Recommended - Easiest)

1. **Login to Keycloak Admin Console**
   - Navigate to: `https://id.finarkein.com/auth/admin`
   - Login with admin credentials

2. **Navigate to Client Settings**
   - Select Realm: `fin-dev`
   - Go to: **Clients** → Select client `client-tsfsl-03d952d6`
   - Click on **Settings** tab

3. **Configure Web Origins**
   - Find the **Web Origins** field
   - Add the following origins (one per line or comma-separated):
     ```
     http://localhost:3000
     https://docs.finarkein.com
     ```
   - Click **Save**

4. **Verify Configuration**
   - The Web Origins setting tells Keycloak to include CORS headers for requests from these origins
   - Keycloak will automatically add the required headers:
     - `Access-Control-Allow-Origin`
     - `Access-Control-Allow-Methods`
     - `Access-Control-Allow-Headers`
     - `Access-Control-Allow-Credentials`

#### Option B: Reverse Proxy (If Keycloak Admin Access Not Available)

If you don't have access to Keycloak admin console, configure CORS on the reverse proxy (Nginx/Apache) in front of Keycloak.

**Nginx Configuration:**
```nginx
location /auth/realms/fin-dev/protocol/openid-connect/token {
    # Handle preflight OPTIONS request
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Methods' 'POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        return 204;
    }

    # Handle actual POST request
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    proxy_pass https://keycloak-backend;
}
```

**Apache Configuration:**
```apache
<Location "/auth/realms/fin-dev/protocol/openid-connect/token">
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "POST, OPTIONS"
    Header always set Access-Control-Allow-Headers "Authorization, Content-Type"
    Header always set Access-Control-Allow-Credentials "true"
    
    # Handle preflight
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^(.*)$ $1 [R=204,L]
</Location>
```

### Testing CORS Fix

Once CORS is configured, test using curl:

```bash
# Test preflight OPTIONS request
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  -v \
  https://id.finarkein.com/auth/realms/fin-dev/protocol/openid-connect/token

# Expected: 200/204 response with CORS headers
```

### Expected Outcome After CORS Fix

1. **Request #1** (GET credentials) → ✅ 200 OK
2. **Request #2** (POST token with correct format) → ✅ 200 OK with access_token
3. **Request #3** (Malformed retry) → ❌ WILL NOT OCCUR

The malformed retry only happens because Request #2 fails due to CORS. Once CORS is fixed, Request #2 succeeds and React Query does not trigger a retry.

---

## 2. How to Check if Other APIs are Getting Bearer Token

### Method 1: Browser DevTools Network Tab

1. **Open DevTools**
   - Press `F12` or right-click → Inspect
   - Go to **Network** tab

2. **Test API Endpoint**
   - In Zudoku API playground, select any API endpoint (e.g., GET /account/aggregate-account)
   - Fill in required parameters (workspace, flowId, etc.)
   - Click **Send** button

3. **Inspect Request Headers**
   - Click on the request in Network tab
   - Go to **Headers** section
   - Look for **Request Headers**
   - Verify presence of:
     ```
     Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
     ```

4. **Check Response**
   - If Bearer token is present and valid: **200 OK** response
   - If Bearer token missing: **401 Unauthorized**
   - If Bearer token invalid/expired: **401 Unauthorized** or **403 Forbidden**

### Method 2: Console Logging (Debugging)

Add temporary logging to `src/apiIdentity.ts`:

```typescript
authorizeRequest: async (request) => {
  // ... existing token fetch code ...
  
  const token = data.access_token;
  
  // Add this logging
  console.log('🔑 Token obtained:', token.substring(0, 20) + '...');
  console.log('🎯 Authorizing request to:', request.url);
  
  request.headers.set("Authorization", `Bearer ${token}`);
  
  console.log('✅ Authorization header set');
  
  return request;
}
```

Then in DevTools Console, you'll see:
```
🔑 Token obtained: eyJhbGciOiJSUzI1Ni...
🎯 Authorizing request to: https://api.finarkein.com/account/aggregate-account
✅ Authorization header set
```

### Method 3: Test with Specific API Endpoints

Create a test checklist for critical endpoints:

```markdown
## Bearer Token Test Checklist

Test each endpoint in API playground:

- [ ] GET /account/aggregate-account/{workspace}/{flowId}
- [ ] GET /fiu/notification
- [ ] POST /consent/request
- [ ] GET /consent/status/{workspace}/{consentId}

For each test:
1. Open Network tab
2. Send request
3. Verify Authorization header present
4. Verify 200 OK response (not 401)
```

### Method 4: Proxy/Intercept Requests

For detailed debugging, use a proxy tool:

**Using Browser Extension (ModHeader/Requestly):**
1. Install ModHeader extension
2. Observe outgoing requests
3. Verify Authorization header is added automatically

**Using Postman Interceptor:**
1. Enable Postman Interceptor in Chrome
2. Capture requests from Zudoku
3. Inspect headers in Postman

### Expected Behavior (After CORS Fix)

```
User Flow:
1. User opens API playground
2. User selects endpoint → Credentials fetched automatically
3. User clicks Send → Token obtained from Keycloak
4. Token injected into Authorization header
5. API request sent with Bearer token
6. Backend validates token → 200 OK response

Network Trace:
[Credentials] GET /api/credentials → 200 OK
[Token]       POST /token → 200 OK (after CORS fix)
[API]         GET /account/... → 200 OK (with Bearer token)
```

### Troubleshooting Bearer Token Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| No Authorization header | Token fetch failed | Check CORS, check credentials |
| 401 Unauthorized | Token invalid/expired | Verify Keycloak issuer, check token expiry |
| 403 Forbidden | Token valid but insufficient permissions | Check client roles/scopes in Keycloak |
| Token not refreshed | Using cached expired token | Add token expiry check in code |

### Quick Verification Script

Run this in browser console after token is obtained:

```javascript
// Verify token structure
const testToken = localStorage.getItem('zudoku_token'); // if stored
if (testToken) {
  const parts = testToken.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log('Token expires at:', new Date(payload.exp * 1000));
  console.log('Token scopes:', payload.scope);
  console.log('Token client:', payload.azp);
}
```

---

## Next Steps

1. **Immediate**: Configure CORS on Keycloak (Option A recommended)
2. **After CORS fix**: Test token flow end-to-end
3. **Verify**: Check Bearer token in API requests using Network tab
4. **Monitor**: Keep an eye on token expiry and refresh logic
5. **Document**: Update internal docs with CORS configuration for future reference

## Questions or Issues?

If CORS is configured correctly but issues persist:
- Check Keycloak client settings (Valid Redirect URIs, Web Origins)
- Verify network security groups/firewalls allow OPTIONS requests
- Check if CDN/WAF is stripping CORS headers
- Review Keycloak logs for token validation errors
