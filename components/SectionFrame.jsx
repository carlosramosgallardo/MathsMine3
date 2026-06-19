'use client';

export default function SectionFrame({ title, accent = '#22d3ee', children, id, stretch = false }) {
  return (
    <section id={id} className={`relative${stretch ? ' flex-1 flex flex-col' : ''}`}>
      <div
        className={`mm3-section-shell section-frame relative rounded-xl${stretch ? ' flex-1 flex flex-col' : ''}`}
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

        <div className={`relative${stretch ? ' flex-1' : ''}`}>
          {children}
        </div>
      </div>
    </section>
  );
}
