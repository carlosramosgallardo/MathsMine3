export const metadata = {
  title: 'Squeezing · Embed',
  robots: { index: false, follow: false },
}

/** Full Squeezing UI for native Android WebView — no portal chrome. */
export default function EmbedSqueezingLayout({ children }) {
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
        .mm3-squeezing-embed {
          min-height: 100%;
          width: 100%;
          max-width: 56rem;
          margin: 0 auto;
          padding: 0.35rem 0.5rem 1.25rem;
          box-sizing: border-box;
        }
      `}</style>
      <div className="mm3-squeezing-embed">{children}</div>
    </>
  )
}
