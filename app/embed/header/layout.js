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
        html.mm3-native-header-embed header {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
        }
        /* Match mobile: controls row 2 lines (pulse+home, then settings+auth) */
        html.mm3-native-header-embed .mm3-header-ticker + div > div.flex {
          flex-direction: column !important;
          align-items: center !important;
          gap: 0.25rem !important;
          padding-top: 0.375rem !important;
          padding-bottom: 0.375rem !important;
          overflow-x: visible !important;
          flex-wrap: nowrap !important;
        }
        html.mm3-native-header-embed .mm3-header-ticker + div > div.flex > div:last-child {
          overflow-x: auto !important;
          max-width: 100% !important;
        }
        html.mm3-native-header-embed .mm3-header-wallet-row {
          overflow-x: auto !important;
          flex-wrap: nowrap !important;
        }
      `}</style>
      {children}
    </>
  );
}
