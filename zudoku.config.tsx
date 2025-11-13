import type { ZudokuConfig } from "zudoku";
import { createApiIdentityPlugin } from "zudoku/plugins";
import { CredentialsPage } from "./src/CredentialsPage.js";
import { getApiIdentities } from "./src/apiIdentity.js";

const config: ZudokuConfig = {
  site: {
    showPoweredBy: false,
    // title: "",
    logo: {
      src: { light: "/finarkein.svg", dark: "/finarkein_dark.svg" },
      alt: "Finarkein",
      width: "130px",
    },
    // banner: {
    //   message: "😁 Welcome to our documentation!",
    //   color: "note", // "note" | "tip" | "info" | "caution" | "danger" or custom
    //   dismissible: true
    // },
    // footer: {
    //   position: "center", // "center" | "end" |
    //   copyright: `© ${new Date().getFullYear()} Finarkein Analytics Private Limited. All rights reserved.`,
    //   social: [
        
    //     {
    //       icon: "github",
    //       href: "https://github.com/yourusername",
    //     },
    //     {
    //       icon: "x",
    //       href: "https://twitter.com/yourhandle",
    //     },
    //   ],
    //   columns: [
    //     {
    //       title: "Product",
    //       position: "center", // position in grid, optional: start, center, end
    //       links: [
    //         { label: "Features", href: "/features" },
    //         { label: "Pricing", href: "/pricing" },
    //         { label: "Documentation", href: "/docs" },
    //         { label: "GitHub", href: "https://github.com/org/repo" }, // Auto-detected as external
    //       ],
    //     },
    //     {
    //       title: "Company",
    //       position: "center",
    //       links: [
    //         { label: "About", href: "/about" },
    //         { label: "Blog", href: "/blog" },
    //         { label: "Contact", href: "/contact" },
    //       ],
    //     },
    // ]
    // },
    
  },
  search: {
    type: "pagefind",
  },
  docs: {
    defaultOptions: {
      showLastModified: true,
      copyPage: false,
      // disablePager: false,
      // toc: true
     }
  },
  navigation: [
    {
      type: "category",
      label: "Introduction",
      icon: "book", // https://lucide.dev/icons
      items: [
        {
          "type": "doc",
          "file": "introduction",
          //"label": "Quick Start"
        },
        {
          type: "category",
          label: "Nerv",
          icon: "sparkles",
          items: [
            "nerv-intro",
            {
              type: "link",
              to: "/nerv",
              label: "API Reference",
              icon: "code"
            }
          ],
        },
        {
          type: "category",
          label: "Portfos",
          icon: "sparkles",
          items: [
            "portfos",
            {
              type: "link",
              to: "/portfos",
              label: "API Reference",
              icon: "code"
            }
          ],
        },
       
      ],
      // link: {
      //   file: "advanced.md",
      //   path: "advanced-guide", // Custom path for category link
      // }
    },
    {
      type: "link",
      to: "/catalog",
      label: "API Catalog",
      icon: "bookmark"
    },
    // {
    //   type: "link",
    //   to: "/test", // can be external link as well eg https://finarkein.com/
    //   label: "type:link",
    //   icon: ""
    // },
    // {
    //   type: "doc",
    //   file: "",
    //   path: "start-here",
    //   label: "type:doc",
    //   badge: {
    //     "label": "Beta",
    //     "color": "yellow"
    //   }
    // },
    {
      type: "custom-page",
      path: "/credentials",
      label: "Credentials",
      icon: "key",
      element: <CredentialsPage />,
      // "display": "auth" // "always" | "anon" | "hide" |
    },
  ],
  // redirects: [{ from: "/", to: "/introduction" }],
  apis: [
    {
      type: "file",
      input: "./openapi.yaml",
      path: "/nerv",
      categories: [{ tags: [], label: "" }],
    },
    {
      type: "file",
      input: "./openapi1.yaml",
      path: "/portfos",
      categories: [{tags: [], label: "" }],
    }
  ],
  catalogs: {
    path: "/catalog",
    label: "API Catalog",
    // items: ["portfos"],
  },
  // authentication: {
  //   type: "clerk",
  //   clerkPubKey:"pk_test_b3Blbi1ibHVlamF5LTMwLmNsZXJrLmFjY291bnRzLmRldiQ"
  // },
  authentication: {
    type: "openid",
    clientId: "backend-service",
    issuer: "http://localhost:8080/realms/fin-dev",
    scopes: ["openid", "profile", "email"] // Optional: add custom scopes if needed
  },
  protectedRoutes: {
    "/oauth/callback": () => true,
    "/*": ({ auth }) => auth.isAuthenticated
  },
  plugins: [
    // Direct API authentication - no proxy layer. Injects Bearer tokens directly into requests to real API endpoints
    createApiIdentityPlugin({
      getIdentities: getApiIdentities,
    }),
  ]
};

export default config;
