import type { ZudokuContext } from "zudoku";
import { authenticatedFetch } from "./lib/http.js";
import { getAccessToken } from "./auth/token.js";

export const getApiIdentities = async (context: ZudokuContext) => {
  return [
    {
      id: "workspace-auth",
      label: "Workspace Authentication",
      authorizeRequest: async (request) => {
        try {
          // Extract workspace from Clerk authentication context
          const workspace = (context.authentication as any)?.providerData?.user
            ?.publicMetadata?.workspace;

          // Determine backend URL for credential fetching
          const backendUrl =
            typeof window !== "undefined"
              ? window.location.hostname === "localhost"
                ? "http://localhost:3001"
                : window.location.origin
              : "http://localhost:3001";

          // Fetch workspace credentials from backend (keeps Keycloak -> env resolution logic)
          let credentialsUrl = `${backendUrl}/api/workspace/credentials`;
          if (workspace) {
            credentialsUrl += `?workspace=${encodeURIComponent(workspace)}`;
          }

          const credentialsResponse = await fetch(credentialsUrl, {
            headers: { "Content-Type": "application/json" },
          });

          if (!credentialsResponse.ok) {
            console.error("Failed to fetch credentials");
            return request;
          }

          const credentials = await credentialsResponse.json();

          // Parse the request URL to replace path parameters
          let targetUrl = request.url;

          // Replace {workspace} parameter
          targetUrl = targetUrl.replace(/\{workspace\}/g, credentials.workspace);

          // Replace {flowId} parameter based on endpoint type
          if (targetUrl.includes("{flowId}")) {
            // Use recurring flow ID for /fetch/ endpoints, nerv flow ID for others
            const flowId = targetUrl.includes("/fetch/")
              ? credentials.flowIds.recurring
              : credentials.flowIds.nerv;
            targetUrl = targetUrl.replace(/\{flowId\}/g, flowId);
          }

          // Use authenticatedFetch from specialized module
          // This handles token caching, 401 retry logic, and Bearer injection automatically
          // Pass the credentials object directly to avoid a second API request
          const response = await authenticatedFetch(targetUrl, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          }, credentials);

          // Convert the Response back to a Request for Zudoku compatibility
          const authenticatedRequest = new Request(targetUrl, {
            method: request.method,
            headers: response.headers,
            body: request.body,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            referrer: request.referrer,
            integrity: request.integrity,
            duplex: "half",
          } as RequestInit);

          return authenticatedRequest;
        } catch (error) {
          throw new Error(`Authentication failed: ${error}`);
        }
      },
    },
  ];
};
