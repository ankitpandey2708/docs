import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { CredentialsPage } from "./src/CredentialsPage.js";

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
          ],
        }
      ],
    },
    {
      type: "link",
      to: "/api",
      label: "API Reference",
    },
    {
      type: "custom-page",
      path: "/credentials",
      label: "Credentials",
      icon: "key",
      element: <CredentialsPage />,
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
  // API authentication is handled automatically via the backend proxy
  authentication: {
    type: "clerk",
    clerkPubKey:"pk_test_b3Blbi1ibHVlamF5LTMwLmNsZXJrLmFjY291bnRzLmRldiQ"
  },
  protectedRoutes: ["/*"],
  plugins: [
    // Handle authentication for API console
    createApiIdentityPlugin({
      getIdentities: async (context) => {
        // Single identity that passes Clerk token to proxy
        // The proxy handles all workspace-specific authentication
        return [{
          id: "workspace-auth",
          label: "Workspace Authentication",
          authorizeRequest: async (request) => {
            try {
              // Get Clerk access token
              const token = await context.authentication?.getAccessToken?.();

              if (!token) {
                return request;
              }

              // Pass the Clerk token to the proxy
              request.headers.set('Authorization', `Bearer ${token}`);

              return request;
            } catch (error) {
              return request;
            }
          },
          // Dynamically provide default parameter values
          getDefaults: async () => {
            console.log('[Zudoku getDefaults] Function called!');
            console.log('[Zudoku getDefaults] Context:', context);
            console.log('[Zudoku getDefaults] Context.authentication:', context.authentication);
            
            try {
              // Extract workspace from context.authentication
              const workspace = (context.authentication as any)?.providerData?.user?.publicMetadata?.workspace;
              
              console.log('[Zudoku getDefaults] Extracted workspace:', workspace);
              console.log('[Zudoku getDefaults] Full auth object:', JSON.stringify(context.authentication, null, 2));
              
              if (!workspace) {
                console.warn('[Zudoku getDefaults] No workspace found, returning static defaults');
                const defaults = {
                  parameters: {
                    workspace: "tsfsl",
                    flowId: "376b71fe-009b-4154-850c-fa0eb65b4d5a"
                  }
                };
                console.log('[Zudoku getDefaults] Returning defaults:', defaults);
                return defaults;
              }

              // Fetch credentials from backend using workspace parameter
              const backendUrl = typeof window !== 'undefined'
                ? (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin)
                : 'http://localhost:3001';

              const url = `${backendUrl}/api/workspace/credentials?workspace=${encodeURIComponent(workspace)}`;
              console.log('[Zudoku getDefaults] Fetching from:', url);

              const response = await fetch(url, {
                headers: {
                  'Content-Type': 'application/json'
                }
              });

              console.log('[Zudoku getDefaults] Response status:', response.status);

              if (response.ok) {
                const credentials = await response.json();
                console.log('[Zudoku getDefaults] Received credentials:', credentials);
                const defaults = {
                  parameters: {
                    workspace: credentials.workspace,
                    flowId: credentials.flowIds.nerv
                  }
                };
                console.log('[Zudoku getDefaults] Returning workspace defaults:', defaults);
                return defaults;
              }
              
              // Fallback to static defaults
              console.warn('[Zudoku getDefaults] Fetch failed with status:', response.status);
              const fallbackDefaults = {
                parameters: {
                  workspace: "tsfsl",
                  flowId: "376b71fe-009b-4154-850c-fa0eb65b4d5a"
                }
              };
              console.log('[Zudoku getDefaults] Returning fallback defaults:', fallbackDefaults);
              return fallbackDefaults;
            } catch (error) {
              console.error('[Zudoku getDefaults] Error:', error);
              const errorDefaults = {
                parameters: {
                  workspace: "tsfsl",
                  flowId: "376b71fe-009b-4154-850c-fa0eb65b4d5a"
                }
              };
              console.log('[Zudoku getDefaults] Returning error defaults:', errorDefaults);
              return errorDefaults;
            }
          }
        }];
      },
    }),
  ]
};

export default config;
