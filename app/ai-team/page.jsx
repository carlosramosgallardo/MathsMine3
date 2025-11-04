import Head from 'next/head';

export default function AITeamPage() {
  const pageTitle = 'MathsMine3 – AI Team';
  const pageDescription =
    'Meet the AI-generated team behind the MathsMine3 social experiment:';
  const canonicalUrl = 'https://mathsmine3.xyz/ai-team';
  const ogImage = 'https://mathsmine3.xyz/og-image.jpg';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'MathsMine3 AI Team',
    itemListElement: [
      {
        '@type': 'VideoObject',
        position: 1,
        name: 'Pedro Sánchez (Founder)',
        description:
          'Founder, anarcho-capitalist and unapologetic crypto bro.',
        thumbnailUrl: 'https://img.youtube.com/vi/r6RTjgJvq5Y/hqdefault.jpg',
        embedUrl: 'https://www.youtube.com/embed/r6RTjgJvq5Y',
        contentUrl: 'https://www.youtube.com/shorts/r6RTjgJvq5Y',
        publisher: { '@type': 'Organization', name: 'MathsMine3' },
      },
      {
        '@type': 'VideoObject',
        position: 2,
        name: 'Fernando Grande-Marlaska (International Relations)',
        description:
          'Handles international relations of every possible kind.',
        thumbnailUrl: 'https://img.youtube.com/vi/GDnYV66vHU4/hqdefault.jpg',
        embedUrl: 'https://www.youtube.com/embed/GDnYV66vHU4',
        contentUrl: 'https://www.youtube.com/shorts/GDnYV66vHU4',
        publisher: { '@type': 'Organization', name: 'MathsMine3' },
      },
      {
        '@type': 'VideoObject',
        position: 3,
        name: 'Patxi López (The Engineer)',
        description: 'Official and reputable fake engineer',
        thumbnailUrl: 'https://img.youtube.com/vi/rv_6a3xI5J4/hqdefault.jpg',
        embedUrl: 'https://www.youtube.com/embed/rv_6a3xI5J4',
        contentUrl: 'https://www.youtube.com/shorts/rv_6a3xI5J4',
        publisher: { '@type': 'Organization', name: 'MathsMine3' },
      },
    ],
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImage} />

        <link rel="preconnect" href="https://www.youtube-nocookie.com" />
        <link rel="preconnect" href="https://img.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="text-center mb-10">
          <h1 className="text-xl font-semibold mt-8 mb-2">Meet the AI Team</h1>
          <p className="text-gray-400">
            A tongue-in-cheek, AI-generated “team” presenting the MathsMine3 experiment:
          </p>
        </header>

        {/* Tres tarjetas del mismo tamaño; 1 col en móvil, 2 en sm, 3 en lg */}
        <section className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card base */}
          <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white">Pedro Sánchez</h2>
              <p className="text-sm text-gray-400">
                Founder, Anarcho-Capitalist and Crypto Bro
              </p>
            </div>
            {/* Mantener 9:16 (Shorts) */}
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{ paddingBottom: '177.78%' }}
            >
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/r6RTjgJvq5Y"
                title="Pedro Sánchez (Founder) — Anarcho-capitalist & Crypto Bro"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white">Fernando Grande-Marlaska</h2>
              <p className="text-sm text-gray-400">International Relations of every kind</p>
            </div>
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{ paddingBottom: '177.78%' }}
            >
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/GDnYV66vHU4"
                title="Fernando Grande-Marlaska (International Relations) — International Relations of every kind"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white">Patxi López</h2>
              <p className="text-sm text-gray-400">Official and reputable fake engineer</p>
            </div>
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{ paddingBottom: '177.78%' }}
            >
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/rv_6a3xI5J4"
                title="Patxi López (The Engineer) — Official and Reputable fake Engineer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
