import type { ZudokuContext } from "zudoku";
import { authenticatedFetch } from "./lib/http.js";
import { buildCredentialsUrl, extractWorkspace } from "./lib/utils.js";
import { HEADERS } from "./lib/constants.js";

export const getApiIdentities = async (context: ZudokuContext) => {
  return [
    {
      id: "workspace-auth",
      label: "Workspace Authentication",
      authorizeRequest: async (request) => {
        // Extract workspace from Clerk authentication context
        const workspace = extractWorkspace(context.authentication);

        // Fetch workspace credentials from backend (keeps Keycloak -> env resolution logic)
        const credentialsUrl = buildCredentialsUrl(workspace);

        const credentialsResponse = await fetch(credentialsUrl, {
          headers: HEADERS.JSON,
        });

        if (!credentialsResponse.ok) {
          return request; // Return original request if credentials fail
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

        try {
          // Try to make authenticated request
          const response = await authenticatedFetch(targetUrl, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          }, credentials);

          return response;
        } catch (error) {
          // If authentication fails (e.g., CORS), return original request
          // This allows Zudoku to make the call without auth (user will see 401)
          return request;
        }
      },
    },
  ];
};
