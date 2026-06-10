const BASE = 'https://mathsmine3.xyz';
const TODAY = new Date().toISOString().split('T')[0];

export default function sitemap() {
  return [
    // ── Core entry points ─────────────────────────────────────────────────────
    {
      url: `${BASE}/`,
      lastModified: TODAY,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE}/training`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 1.0,
    },

    // ── Live gameplay pages (update every tick) ───────────────────────────────
    {
      url: `${BASE}/mining`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE}/ranking`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE}/relaying`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE}/trading`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE}/squeezing`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE}/mm3-value`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE}/daily-tasks`,
      lastModified: TODAY,
      changeFrequency: 'daily',
      priority: 0.7,
    },

    // ── Stable content pages ──────────────────────────────────────────────────
    {
      url: `${BASE}/manifesto`,
      lastModified: TODAY,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE}/ai-team`,
      lastModified: TODAY,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/api`,
      lastModified: TODAY,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // ── Security audit ────────────────────────────────────────────────────────
    {
      url: `${BASE}/security`,
      lastModified: TODAY,
      changeFrequency: 'weekly',
      priority: 0.7,
    },

    // ── Legal ─────────────────────────────────────────────────────────────────
    {
      url: `${BASE}/privacy`,
      lastModified: TODAY,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      lastModified: TODAY,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
