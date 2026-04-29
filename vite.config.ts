import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PROD_CSP = [
  "default-src 'self'",
  "style-src 'self'",
  "script-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const DEV_CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' ws: http: https:",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: "codabind-csp",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          const csp = command === "build" ? PROD_CSP : DEV_CSP;
          return html.replace("%CSP%", csp);
        },
      },
    },
  ],
}));
