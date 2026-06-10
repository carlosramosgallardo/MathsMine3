// Layout override for chain3d: removes main's bottom padding and prevents scroll,
// so the 3D view fills exactly from below the fixed header to the bottom of the viewport.
export default function Chain3DLayout({ children }) {
  return (
    <>
      <style>{`
        html:has(.mm3-chain3d-root) .mm3-shell-main {
          padding-bottom: 0 !important;
          overflow: hidden !important;
        }
      `}</style>
      <div className="mm3-chain3d-root h-full overflow-hidden">
        {children}
      </div>
    </>
  )
}
