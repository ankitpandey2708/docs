import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { CredentialsPage } from "./src/CredentialsPage.js";
import { getApiIdentities } from "./src/apiIdentity.js";

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
            "/introduction"
          ],
        },
        {
          type: "category",
          label: "Configuration",
          icon: "settings",
          items: [
            "/keycloak-setup",
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
  // Clerk authentication protects documentation pages
  // API calls go directly to real endpoints with Bearer token injection
  authentication: {
    type: "clerk",
    clerkPubKey:"pk_test_b3Blbi1ibHVlamF5LTMwLmNsZXJrLmFjY291bnRzLmRldiQ"
  },
  protectedRoutes: ["/*"],
  plugins: [
    // Direct API authentication - no proxy layer
    // Injects Bearer tokens directly into requests to real API endpoints
    createApiIdentityPlugin({
      getIdentities: getApiIdentities,
    }),
  ]
};

export default config;
