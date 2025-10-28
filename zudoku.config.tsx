import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { apiKeyPlugin } from "zudoku/plugins/api-keys";
import { MyApiKeyService } from "./src/MyApiKeyService";

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
  // API authentication is handled automatically via the backend proxy
  authentication: {
    type: "clerk",
    clerkPubKey:"pk_test_b3Blbi1ibHVlamF5LTMwLmNsZXJrLmFjY291bnRzLmRldiQ"
  },
  protectedRoutes: ["/*"],
  plugins: [
    apiKeyPlugin(MyApiKeyService),
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
                console.warn('[Zudoku] No Clerk token available');
                return request;
              }

              // Simply pass the Clerk token to the proxy
              // The proxy will:
              // 1. Verify the Clerk token
              // 2. Extract workspace from user metadata
              // 3. Fetch workspace credentials
              // 4. Handle authentication to Finarkein API
              // 5. Auto-fill path parameters
              request.headers.set('Authorization', `Bearer ${token}`);
              
              return request;
            } catch (error) {
              console.error('[Zudoku] Error in authorizeRequest:', error);
              return request;
            }
          },
        }];
      },
    }),
  ]
};

export default config;
