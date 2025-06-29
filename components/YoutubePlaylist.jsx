const YoutubePlaylist = () => {
  return (
    <div className="w-full max-w-4xl mx-auto my-8 space-y-10">
      {/* Video 1 – Shorts video convertido a embed */}
      <div className="aspect-video">
        <iframe
          className="w-full h-full rounded-2xl shadow-lg"
          src="https://www.youtube.com/embed/z65hzonypF4"
          title="MathsMine3 – Web3 Shorts Teaser"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>

      {/* Añadir más vídeos a mano aquí */}
      {/* 
      <div className="aspect-video">
        <iframe
          className="w-full h-full rounded-2xl shadow-lg"
          src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
          title="Your video title"
          ...
        ></iframe>
      </div>
      */}
    </div>
  );
};

export default YoutubePlaylist;
