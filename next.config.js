const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  allowedDevOrigins: ['mathsmine3.xyz'],
  experimental: {
    optimizePackageImports: ['recharts', 'three'],
  },
  async redirects() {
    return []
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };
    return config;
  },
  async headers() {
    return [
      // ── Security headers (all routes) ─────────────────────────────────────
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          {
            // Next.js requires unsafe-inline/eval for hydration & client components.
            // Frame-ancestors, object-src, base-uri, form-action and
            // upgrade-insecure-requests are enforced without restriction.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
              "style-src 'self' 'unsafe-inline' https:",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https:",
              "connect-src 'self' https: wss:",
              "media-src 'self' blob:",
              "worker-src blob: 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      // ── Sitemap cache control ──────────────────────────────────────────────
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      {
        source: "/sitemap-0.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      // ── Rate-limit advertisement on hot game endpoints ──────────────────────
      // Defence-in-depth signalling: publishes the intended per-route limit.
      // Actual burst protection is provided by Vercel's platform DDoS layer plus
      // each endpoint's own game-logic guards (cooldowns, HP/level checks). We do
      // NOT run a per-request in-memory/DB limiter on these paths on purpose —
      // pvp-hit/stormroll/mine-block are hot and a DB round-trip per call would
      // add Supabase load we've been trimming.
      ...[
        "/api/pvp-hit",
        "/api/mine-block",
        "/api/stormroll-damage",
        "/api/daily-tasks/claim",
        "/api/chain-solve/attempt",
        "/api/relay/exec",
      ].map((source) => ({
        source,
        headers: [
          { key: "X-RateLimit-Limit", value: "30" },
          { key: "X-RateLimit-Remaining", value: "30" },
          { key: "X-RateLimit-Reset", value: "60" },
        ],
      })),
      // ── Cache-poisoning defence: vary the home page on the host header ───────
      {
        source: "/",
        headers: [
          {
            key: "Vary",
            value: "X-Forwarded-Host",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
