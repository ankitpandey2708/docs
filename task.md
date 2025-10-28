# Task

Simplify the API-docs app implementation (built with **Zudoku**) while keeping behavior identical for customers. Remove proxy code and fix **local CORS** cleanly without changing any **base URLs** shown in docs.


# Context (must preserve)

- Source of OpenAPI: generated from our **Postman collection** (OpenAPI 2.0).

* Customers currently use Postman collections + env files we email.

- New app will be used by **external customers**; endpoints and base URLs displayed in docs must match the Postman collection/env exactly.

* Auth in docs app:

- **Clerk** protects docs UI; we read claims to map variables to **Keycloak (prod)** or local **env**.

- API calls in the OpenAPI require **Bearer token** obtained from **Generate Access Token** endpoint.

- Token endpoint base URL comes from `AUTH_TOKEN_URL` (env).

- Token endpoint uses **Basic Auth** with `AUTH_CLIENT_ID` (username) and `AUTH_CLIENT_SECRET` (password).

* “Workspace” == client name. These vary per client via env:

<!---->

    AUTH_CLIENT_ID

    AUTH_CLIENT_SECRET

    nerv.flow.id

    recurring.nerv.flow.id

- `/credentials` page already fetches variables via Keycloak (prod) or env (dev). Keep this.


# Constraints

1. **No proxy** layer that rewrites or exposes different base URLs. What customers see must stay identical to Postman/env.

2. **Fix CORS at the backend or via allowed-origins config**; do not introduce client-side hacks or browser extensions.

3. Keep `/credentials` behavior and variable mapping exactly as today.

4. Keep all auth flows and environment variable names unchanged.


# Deliverables

1. **Code changes** (diffs or files) to:

- Remove existing proxy code and related config.

- Centralize token acquisition (Basic → Bearer) and inject `Authorization: Bearer <token>` for all OpenAPI/try-it calls.

- Read dynamic variables from Clerk claims → Keycloak (prod) or `.env` (dev) without proxy.

- Ensure Zudoku consumes the **OpenAPI 2.0** spec (from Postman) unchanged.

2. **Backend CORS configuration** sample for our company APIs to support:

- Allowed origins: `http://localhost:3000`, `http://127.0.0.1:3000`, and the prod docs domain (e.g., `https://docs.example.com`).

- Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.

- Allowed headers: `Authorization, Content-Type, Accept, X-Requested-With`.

- Expose headers if needed: `Authorization`.

- `Access-Control-Allow-Credentials: false` (unless we truly need cookies).

- Proper **preflight** handling (`OPTIONS`) with 204/200 and `Access-Control-Max-Age`.

3. **Environment setup**:

- `.env.example` including `AUTH_TOKEN_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `nerv.flow.id`, `recurring.nerv.flow.id`, plus any Zudoku/Clerk/Keycloak vars you read.

4. **Tests/verification steps**:

- Local: start app, obtain token via `AUTH_TOKEN_URL` using Basic auth, call any secured endpoint with Bearer token, verify CORS preflight passes.

- Prod-like: build & run against staging; verify no base-URL changes in UI or network panel.


# Implementation Notes (do this)

- **Token flow utility** Create `auth/token.ts`:

* `getAccessToken(): Promise<string>` → posts to `AUTH_TOKEN_URL` with Basic auth using `AUTH_CLIENT_ID`/`AUTH_CLIENT_SECRET`; caches token in memory with expiry.

- **HTTP client** Wrap `fetch`/axios in `lib/http.ts`:

* Inject `Authorization: Bearer <token>` from `getAccessToken()`.

* Retry once on 401 by refreshing token.

- **Zudoku integration**

* Load `openapi2.yaml` without modification.

* For “Try it” requests, route to real base URLs from the spec (no proxy).

* Use variable resolver that pulls from **Clerk claims → Keycloak** (prod) or **process.env** (dev) to populate templated values.

- **Remove proxy**

* Delete proxy middleware/config (e.g., Next.js rewrites, Vite devProxy, Nginx conf), related envs, and docs.

- **CORS**

* Provide a snippet for our backend (Node/Express example):

<!---->

    app.use((req, res, next) => {
      const allowed = new Set([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://docs.example.com' // prod docs origin
      ]);
      const origin = req.headers.origin;
      if (origin && allowed.has(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept,X-Requested-With');
        res.header('Access-Control-Max-Age', '86400');
      }
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });


# Acceptance Criteria

- No proxy code remains; **network requests go directly** to the API base URLs from `openapi2.yaml`.

- **CORS succeeds** locally and in prod for the specified origins.

- Docs show **identical base URLs** and endpoints to Postman.

- `/credentials` still resolves variables from Keycloak (prod) or env (dev).

- All secured endpoints succeed via Bearer tokens obtained through `AUTH_TOKEN_URL` using Basic auth.

- Swapping client env values (`AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `nerv.flow.id`, `recurring.nerv.flow.id`) correctly changes workspaces.
