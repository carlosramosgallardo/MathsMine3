import Head from 'next/head';

export default function AITeamPage() {
  const pageTitle = 'MathsMine3 – AI Team';
  const pageDescription =
    'Meet the AI-generated team behind the MathsMine3 social experiment. Two intros are live; the engineer joins soon.';
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
        name: 'Peter Sánxez — Founder (AI)',
        description:
          'Founder, anarcho-capitalist and unapologetic crypto bro. AI-generated team intro.',
        thumbnailUrl: 'https://img.youtube.com/vi/r6RTjgJvq5Y/hqdefault.jpg',
        embedUrl: 'https://www.youtube.com/embed/r6RTjgJvq5Y',
        contentUrl: 'https://www.youtube.com/shorts/r6RTjgJvq5Y',
        publisher: { '@type': 'Organization', name: 'MathsMine3' },
      },
      {
        '@type': 'VideoObject',
        position: 2,
        name: 'Fernandisco Glande-Marlaska — International Relations (AI)',
        description:
          'Handles international relations of every possible kind. AI-generated team intro.',
        thumbnailUrl: 'https://img.youtube.com/vi/GDnYV66vHU4/hqdefault.jpg',
        embedUrl: 'https://www.youtube.com/embed/GDnYV66vHU4',
        contentUrl: 'https://www.youtube.com/shorts/GDnYV66vHU4',
        publisher: { '@type': 'Organization', name: 'MathsMine3' },
      },
      {
        '@type': 'VideoObject',
        position: 3,
        name: 'Patshi Lópes — The Engineer (AI)',
        description: 'Engineer intro. AI-generated team member presentation.',
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
            A tongue-in-cheek, AI-generated “team” presenting the MathsMine3 experiment.
          </p>
        </header>

        <section className="grid gap-8 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white">Peter Sánxez</h2>
              <p className="text-sm text-gray-400">
                Founder — anarcho-capitalist &amp; crypto bro (AI)
              </p>
            </div>
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{ paddingBottom: '177.78%' }}
            >
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/r6RTjgJvq5Y"
                title="Peter Sánxez — Founder (AI)"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white">Fernandisco Glande-Marlaska</h2>
              <p className="text-sm text-gray-400">International Relations of every kind (AI)</p>
            </div>
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{ paddingBottom: '177.78%' }}
            >
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/GDnYV66vHU4"
                title="Fernandisco Glande-Marlaska — International Relations (AI)"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/40 p-4 md:col-span-2">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white">Patshi Lópes</h2>
              <p className="text-sm text-gray-400">The Engineer (AI)</p>
            </div>
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{ paddingBottom: '177.78%' }}
            >
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/rv_6a3xI5J4"
                title="Patshi Lópes — The Engineer (AI)"
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
