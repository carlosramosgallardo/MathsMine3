// Constrains the 3D game canvas width and prevents page scroll so it fills
// exactly from the header to the bottom of the viewport — same treatment as
// chain3d but with a max-width cap so the canvas never exceeds 1024 px on
// wide monitors.  Wider canvases render more raycaster strips per frame,
// making the game visibly slower on older / integrated-GPU hardware.
export const metadata = {
  title: 'Mining',
  description: 'The MathsMine3 3D mining world — a 28×28 block grid you can walk through in real time. Buy and resell NFTJI blocks, unlock daily Relaying commands, and penalise competing wallets.',
  openGraph: {
    title: 'Mining · MathsMine3',
    description: '28×28 NFTJI block board. Buy, resell, and fire daily Relaying commands.',
    url: 'https://mathsmine3.xyz/mining',
  },
  alternates: { canonical: '/mining' },
};

export default function MiningLayout({ children }) {
  return (
    <>
      <style>{`
        html:has(.mm3-mining3d-root) .mm3-shell-main {
          padding-bottom: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          overflow: hidden !important;
          height: 100vh;
          height: 100dvh;
        }
        .mm3-mining3d-root {
          width: 100%;
        }
        @media (min-width: 900px) {
          .mm3-mining3d-root {
            max-width: 1024px;
            margin-left: auto;
            margin-right: auto;
          }
        }
      `}</style>
      <div className="mm3-mining3d-root h-full overflow-hidden">
        {children}
      </div>
    </>
  )
}
