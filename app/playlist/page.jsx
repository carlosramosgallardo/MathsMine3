import YoutubePlaylist from '@/components/YoutubePlaylist';
import Head from 'next/head';

export default function PlaylistPage() {
  return (
    <>
      <Head>
        <title>MathsMine3 – Official Video Playlist</title>
        <meta name="description" content="Watch the official video playlist of MathsMine3: gameplay, philosophy, and behind-the-scenes of this Web3 social experiment." />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "name": "MathsMine3 Video Playlist",
              "description": "Watch official MathsMine3 videos: gameplay, token dynamics, voting, and Web3 social mechanics.",
              "thumbnailUrl": "https://mathsmine3.xyz/images/MM3_thumbnail.jpg",
              "uploadDate": "2025-04-18",
              "embedUrl": "https://www.youtube.com/embed/videoseries?list=PLVnPpTxW6VSe486FBj1R7mzA2XczNYqXc",
              "contentUrl": "https://www.youtube.com/playlist?list=PLVnPpTxW6VSe486FBj1R7mzA2XczNYqXc",
              "publisher": {
                "@type": "Organization",
                "name": "MathsMine3"
              }
            })
          }}
        />
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold mt-8 mb-2">Official MathsMine3 Video Playlist</h1>
        <p className="text-center text-gray-500 mb-6">
          Watch videos about the MathsMine3 project: gameplay mechanics, philosophical foundations, token dynamics, and community interaction.
        </p>
        <YoutubePlaylist />
      </div>
    </>
  );
}
