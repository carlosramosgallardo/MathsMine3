'use client';

export default function SectionFrame({
  title,
  accent = '#22d3ee',
  children,
  id
}) {
  return (
    <section id={id} className="relative my-12">
      <div
        className="mm3-pixel-frame relative rounded-xl"
        style={{ ['--mm3-accent']: accent }}
      >
        {/* Reserva superior generosa para que la placa no se corte */}
        <div className="h-10" aria-hidden="true" />

        {/* Placa/título 8-bit centrada (dentro del marco, sin offsets negativos) */}
        {title && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            <span className="mm3-chip px-3 py-1 font-mono text-xs uppercase tracking-widest select-none">
              {title}
            </span>
          </div>
        )}

        {/* Textura sutil */}
        <div className="mm3-scanlines pointer-events-none" aria-hidden="true" />

        {/* Contenido */}
        <div className="relative p-4 sm:p-6 md:p-8">
          {children}
        </div>

        {/* Línea glow inferior (separador visual claro) */}
        <div className="mm3-glow-divider" aria-hidden="true" />
      </div>
    </section>
  );
}
