// Constrains the 3D game canvas width and prevents page scroll so it fills
// exactly from the header to the bottom of the viewport — same treatment as
// chain3d but with a max-width cap so the canvas never exceeds 1440 px on
// wide monitors.  Wider canvases render more raycaster strips per frame,
// making the game visibly slower on older / integrated-GPU hardware.
export const metadata = {
  title: 'Mining',
  description: 'The MathsMine3 Mining board — a 28×28 block grid. Buy and resell NFTJI blocks, unlock daily Relaying commands, and penalise competing wallets.',
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
          padding-bottom: 32px !important;
          overflow: hidden !important;
          height: 100vh;
          height: 100dvh;
        }
      `}</style>
      <div className="mm3-mining3d-root h-full overflow-hidden" style={{ maxWidth: 512, margin: '0 auto' }}>
        {children}
      </div>
    </>
  )
}
