'use client';

export default function SectionFrame({ title, accent = '#22d3ee', children, id }) {
  return (
    <section id={id} className="relative">
      <div
        className="mm3-pixel-frame section-frame relative rounded-xl"
        style={{ ['--mm3-accent']: accent }}
      >
        {title && (
          <>
            <div className="h-8" aria-hidden="true" />
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
              <span className="mm3-chip px-3 py-1 font-mono text-xs uppercase tracking-widest select-none">
                {title}
              </span>
            </div>
          </>
        )}

        <div className="mm3-scanlines pointer-events-none" aria-hidden="true" />

        <div className="relative p-3 sm:p-4">
          {children}
        </div>

        <div className="mm3-glow-divider" aria-hidden="true" />
      </div>
    </section>
  );
}
