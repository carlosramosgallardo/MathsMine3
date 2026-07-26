// Compact shell for the portal Header strip inside the Android app.
export const metadata = {
  title: 'Header · Embed',
  robots: { index: false, follow: false },
};

export default function EmbedHeaderLayout({ children }) {
  return (
    <>
      <style>{`
        html.mm3-native-header-embed,
        html.mm3-native-header-embed body {
          background: #01070e !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          height: auto !important;
          min-height: 0 !important;
        }
        html.mm3-native-header-embed .mm3-shell-main {
          padding: 0 !important;
          margin: 0 !important;
          height: auto !important;
          overflow: visible !important;
        }
        /* Flow in the WebView strip — not fixed over a phantom page */
        html.mm3-native-header-embed header {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
        }
        /* Same wrap as max-sm portrait portal */
        html.mm3-native-header-embed .mm3-header-ticker + div > div.flex.h-12,
        html.mm3-native-header-embed .mm3-header-ticker + div > div.flex.h-14 {
          height: auto !important;
          min-height: 3rem;
          flex-wrap: wrap;
          column-gap: 0.5rem;
          row-gap: 0.25rem;
          padding-top: 0.375rem;
          padding-bottom: 0.375rem;
        }
        html.mm3-native-header-embed .mm3-header-ticker + div .hidden.basis-full {
          display: block !important;
          height: 0;
          flex-basis: 100%;
        }
        html.mm3-native-header-embed .mm3-header-ticker + div .contents {
          display: flex !important;
          width: 100%;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        html.mm3-native-header-embed .mm3-clock-controls { display: block !important; }
        html.mm3-native-header-embed .mm3-clock-wallet { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
