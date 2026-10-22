import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy for the Memex route.
 *
 * Scoped to `/tools/memex` only, and deliberately not applied to the whole
 * app: the other tools legitimately call third-party APIs (exchange rates,
 * translation, dictionary, the ONNX model CDN), so a global `connect-src
 * 'self'` would break them.
 *
 * Memex makes **no network calls at all**, so `connect-src 'self'` is the
 * strongest guarantee this page can give: even if a script injection or a
 * rogue extension managed to run code on the page, it could not ship the
 * notes to another origin.
 *
 * Why `'unsafe-inline'` for scripts rather than a per-request nonce: a
 * nonce-based CSP requires dynamic rendering plus a `proxy.ts`, and this
 * project is deliberately static with no middleware. The inline scripts in
 * the prerendered HTML are Next.js' own bootstrap scripts. `'unsafe-inline'`
 * still blocks a `<script src="https://elsewhere.example">` tag, which is
 * the case that matters for a third-party script leak.
 *
 * Known limitation: CSP is applied when the document is loaded. A client
 * side navigation to this route keeps the CSP of the page the user came
 * from, so the guarantee holds on a direct visit, a hard reload or a
 * shared link, but not on a soft in-app navigation. See `docs/memex.md`.
 */
const memexCsp = [
  "default-src 'self'",
  // 'self' covers the Next.js chunks and the same-origin Vercel Analytics
  // script; 'unsafe-inline' covers Next.js' own inline bootstrap scripts.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Memex never talks to a server, so anything but 'self' is a leak.
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/tools/memex",
        headers: [
          { key: "Content-Security-Policy", value: memexCsp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/tools/dictionary",
        destination: "/tools/translate",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
