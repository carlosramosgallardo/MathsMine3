// app/api/orb-color/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

// Mapea delta -> color (amarillo→rojo si delta>0, amarillo→verde si delta<0).
function pickColorFromDelta(delta: number) {
  // Normalizamos delta para tener una sensación: 0.0 .. 1.0
  // Puedes ajustar 'S' para sensibilidad.
  const S = 0.0005; // cuanto más pequeño, más “rápido” cambia de color
  const mag = clamp01(Math.abs(delta) / S);

  if (delta >= 0) {
    // POSITIVO: HSL de 50° (amarillo) a 0° (rojo)
    const h = 50 - 50 * mag;
    return hslToHex(h, 100, 50);
  } else {
    // NEGATIVO: HSL de 50° (amarillo) a 120° (verde)
    const h = 50 + 70 * mag; // 120 sería verde puro; llegamos aprox
    return hslToHex(h, 100, 45);
  }
}

// Utilidad HSL -> HEX
function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  // Devuelve el color actual por si lo necesitas
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('mm3_visual_state')
    .select('color_hex')
    .eq('id', 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, color_hex: data?.color_hex ?? '#000000' });
}

export async function POST(req: Request) {
  // Espera { delta: number } desde el Board
  const body = await req.json().catch(() => ({}));
  const delta = Number(body?.delta);
  if (!Number.isFinite(delta)) {
    return NextResponse.json({ ok: false, error: 'Bad delta' }, { status: 400 });
  }

  const newColor = pickColorFromDelta(delta);

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('mm3_visual_state')
    .update({ color_hex: newColor })
    .eq('id', 1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, color_hex: newColor });
}
