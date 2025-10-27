import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { apiKeyPlugin } from "zudoku/plugins/api-keys";
import { MyApiKeyService } from "./src/MyApiKeyService";

const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin)
  : 'http://localhost:3001';

const config: ZudokuConfig = {
  site: {
    showPoweredBy: false,
    title: "Finarkein API Documentation",
    logo: {
      src: { light: "/finarkein.svg", dark: "/finarkein_dark.svg" },
      alt: "Finarkein",
      width: "130px",
    },
  },
  search: {
    type: "pagefind",
  },
  docs: {
    defaultOptions: {
      showLastModified: true
    }
  },
  navigation: [
    {
      type: "category",
      label: "User Documentation",
      items: [
        {
          type: "category",
          label: "Getting Started",
          icon: "sparkles",
          items: [
            "/introduction",
            {
              type: "link",
              icon: "folder-cog",
              badge: {
                label: "New",
                color: "purple",
              },
              label: "API Reference",
              to: "/api",
            },
          ],
        },
        {
          type: "category",
          label: "Useful Links",
          collapsible: false,
          icon: "link",
          items: [
            {
              type: "link",
              icon: "book",
              label: "Zudoku Docs",
              to: "https://zudoku.dev/docs/",
            },
          ],
        },
      ],
    },
    {
      type: "link",
      to: "/api",
      label: "API Reference",
    },
  ],
  redirects: [{ from: "/", to: "/introduction" }],
  apis: [
    {
      type: "file",
      input: "./openapi.yaml",
      path: "/api",
    }
  ],
  // Clerk authentication is only for the documentation pages
  // API authentication is handled via OAuth2/Bearer tokens defined in OpenAPI spec
  authentication: {
    type: "clerk",
    clerkPubKey:"pk_test_b3Blbi1ibHVlamF5LTMwLmNsZXJrLmFjY291bnRzLmRldiQ"
  },
  protectedRoutes: ["/*"],
  plugins: [
    apiKeyPlugin(MyApiKeyService),
    createApiIdentityPlugin({
      getIdentities: async (context) => {
        // Fetch workspace credentials from backend
        const fetchCredentials = async () => {
          try {
            const token = await context.authentication?.getAccessToken?.();
            if (!token) {
              console.warn('No Clerk token available for API identity');
              return null;
            }

            const response = await fetch(`${API_BASE_URL}/api/workspace/credentials`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok) {
              console.error('Failed to fetch workspace credentials for API identity');
              return null;
            }

            return await response.json();
          } catch (error) {
            console.error('Error fetching credentials for API identity:', error);
            return null;
          }
        };

        const credentials = await fetchCredentials();

        if (!credentials) {
          // Return default identity if credentials not available
          return [{
            id: "default",
            label: "Default (Unauthorized)",
            authorizeRequest: async (request) => request,
          }];
        }

        // Return identity that auto-injects OAuth2 token
        return [{
          id: `workspace-${credentials.workspace}`,
          label: `${credentials.workspace.toUpperCase()} Workspace`,
          authorizeRequest: async (request) => {
            // Exchange credentials for bearer token using backend proxy
            try {
              const tokenResponse = await fetch(`${API_BASE_URL}/api/token/exchange`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${await context.authentication?.getAccessToken()}`,
                  'Content-Type': 'application/json'
                }
              });

              if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                request.headers.set('Authorization', `Bearer ${tokenData.access_token}`);

                // Auto-fill workspace and flowId parameters in the URL
                const url = new URL(request.url);

                // Replace {workspace} placeholder in path
                if (url.pathname.includes('{workspace}')) {
                  url.pathname = url.pathname.replace('{workspace}', credentials.workspace);
                }

                // Replace {flowId} placeholder in path
                if (url.pathname.includes('{flowId}')) {
                  // Default to nerv flow, unless it's a recurring endpoint
                  const flowId = url.pathname.includes('/fetch/')
                    ? credentials.flowIds.recurring
                    : credentials.flowIds.nerv;
                  url.pathname = url.pathname.replace('{flowId}', flowId);
                }

                return new Request(url.toString(), request);
              }
            } catch (error) {
              console.error('Failed to exchange token:', error);
            }

            return request;
          },
        }];
      },
    }),
  ]
};

export default config;
