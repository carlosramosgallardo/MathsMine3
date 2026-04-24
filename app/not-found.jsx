import Link from 'next/link'

export const metadata = { title: '404 Not Found' }

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mm3-pixel-frame p-10 max-w-md w-full">
        <div className="mm3-scanlines" />
        <p className="text-6xl font-bold glow-accent mb-2">404</p>
        <p className="text-slate-400 text-sm mb-6 font-mono">
          Block not found — this chunk of the chain is empty.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 rounded-lg border border-cyan-500/40 text-cyan-400 text-sm font-mono hover:border-cyan-400 hover:text-white hover:shadow-[0_0_14px_rgba(34,211,238,.4)] transition-all"
        >
          ← Back to the mine
        </Link>
      </div>
    </div>
  )
}
