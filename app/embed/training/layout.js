export const metadata = {
  title: 'Training · Embed',
  robots: { index: false, follow: false },
}

/** Full Training board for native Android WebView — no portal chrome. */
export default function EmbedTrainingLayout({ children }) {
  return (
    <>
      <style>{`
        html, body {
          background: #070b0f !important;
          overflow: hidden !important;
          height: 100% !important;
        }
        .mm3-shell-main {
          padding: 0 !important;
          margin: 0 !important;
          height: 100vh !important;
          height: 100dvh !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch;
        }
        .mm3-training-embed {
          min-height: 100%;
          width: 100%;
          max-width: 32rem;
          margin: 0 auto;
          padding: 0.5rem 0.5rem 1.25rem;
          box-sizing: border-box;
        }
      `}</style>
      <div className="mm3-training-embed">{children}</div>
    </>
  )
}
