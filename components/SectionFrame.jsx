'use client';

export default function SectionFrame({
  title,
  accent = '#22d3ee',
  children,
  id
}) {
  // Nota: todo es visual, sin persistencia
  return (
    <section id={id} className="relative my-10">
      <div
        className="mm3-pixel-frame relative rounded-xl overflow-hidden"
        style={{ ['--mm3-accent']: accent }}
      >
        {/* Título estilo “placa” pixel */}
        {title && (
          <div className="absolute -top-3 left-6 z-10">
            <span className="mm3-chip px-3 py-1 font-mono text-xs uppercase tracking-widest">
              {title}
            </span>
          </div>
        )}

        {/* Fondo con grid + scanlines sutiles */}
        <div className="mm3-scanlines pointer-events-none" aria-hidden="true" />

        {/* Contenido */}
        <div className="relative p-4 sm:p-6 md:p-8">
          {children}
        </div>

        {/* Divider inferior luminiscente */}
        <div className="mm3-glow-divider" aria-hidden="true" />
      </div>
    </section>
  );
}
