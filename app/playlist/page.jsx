import YoutubePlaylist from '@/components/YoutubePlaylist';
import Head from 'next/head';

export default function PlaylistPage() {
  return (
    <>
      <Head>
        <title>MathsMine3 – Official Video Playlist</title>
        <meta
          name="description"
          content="Official video playlist of MathsMine3"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "name": "MathsMine3 – Web3 Shorts Teaser",
              "description": "A fast-paced teaser of the MathsMine3 social experiment. Connect your wallet, solve math, and shape the future.",
              "thumbnailUrl": "https://img.youtube.com/vi/z65hzonypF4/hqdefault.jpg",
              "uploadDate": "2025-04-18",
              "embedUrl": "https://www.youtube.com/shorts/z65hzonypF4",
              "contentUrl": "https://www.youtube.com/shorts/z65hzonypF4",
              "publisher": {
                "@type": "Organization",
                "name": "MathsMine3"
              }
            })
          }}
        />
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold mt-8 mb-2">Official MathsMine3 Video Playlist</h1>
          <p className="text-gray-400">
            Watch videos about the MathsMine3 project.
          </p>
        </div>
        <YoutubePlaylist />
      </div>
    </>
  );
}
