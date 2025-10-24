import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { apiKeyPlugin } from "zudoku/plugins/api-keys";
import { MyApiKeyService } from "./src/MyApiKeyService";


const config: ZudokuConfig = {
  site: {
    showPoweredBy: false,
    title: "Documentation",
    logo: {
      src: { light: "/finarkein.svg", dark: "/finarkein_dark.svg" },
      alt: "Finarkein",
      width: "130px",
    },
  },
  navigation: [
    {
      type: "category",
      label: "Finarkein Documentation",
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
  authentication: {
    type: "clerk",
    clerkPubKey:"pk_test_b3Blbi1ibHVlamF5LTMwLmNsZXJrLmFjY291bnRzLmRldiQ"
  },
  protectedRoutes: ["/*"],
  plugins: [
    apiKeyPlugin(MyApiKeyService),
    createApiIdentityPlugin({
      getIdentities: async (context) => [
        {
          id: "clerk-auth",
          label: "Authenticated API Access",
          authorizeRequest: async (request) => {
            // Get the access token from Clerk authentication provider (await the Promise)
            const token = await context.authentication?.getAccessToken();
 
            if (token) {
              request.headers.set("Authorization", `Bearer ${token}`);
            } else {
            }

            return request;
          },
        },
      ],
    }),
  ]
};

export default config;
