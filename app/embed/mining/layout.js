// Full-bleed FPV for native Android WebView — no 1024px desktop cap.
export const metadata = {
  title: 'Mining · Embed',
  robots: { index: false, follow: false },
};

export default function EmbedMiningLayout({ children }) {
  return (
    <>
      <style>{`
        html:has(.mm3-mining3d-root) .mm3-shell-main,
        .mm3-shell-main {
          padding: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
          height: 100vh !important;
          height: 100dvh !important;
        }
        .mm3-mining3d-root {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          height: 100% !important;
        }
        html, body {
          background: #070b0f !important;
          overflow: hidden !important;
          height: 100% !important;
        }
      `}</style>
      <div className="mm3-mining3d-root h-full overflow-hidden">{children}</div>
    </>
  );
}
