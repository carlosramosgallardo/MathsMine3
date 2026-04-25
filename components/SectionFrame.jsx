'use client';

export default function SectionFrame({ title, accent = '#22d3ee', children, id }) {
  return (
    <section id={id} className="relative">
      <div
        className="mm3-section-shell section-frame relative rounded-xl"
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

        <div className="relative">
          {children}
        </div>
      </div>
    </section>
  );
}
