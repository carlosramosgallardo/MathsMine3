export const metadata = {
  title: 'Trading · Embed',
  robots: { index: false, follow: false },
}

/** Full TradeBoard for native Android WebView — no portal chrome. */
export default function EmbedTradingLayout({ children }) {
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
        .mm3-trading-embed {
          min-height: 100%;
          width: 100%;
          max-width: 48rem;
          margin: 0 auto;
          padding: 0.35rem 0.5rem 1.25rem;
          box-sizing: border-box;
        }
        .mm3-trading-embed .mm3-trade-page {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
      `}</style>
      <div className="mm3-trading-embed">{children}</div>
    </>
  )
}
