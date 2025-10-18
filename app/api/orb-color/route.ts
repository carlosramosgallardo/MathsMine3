// app/api/orb-color/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usa la SERVICE_ROLE KEY del server (NUNCA la expongas al cliente)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // <- server-only
);

// helpers
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function hslToHex(h: number, s: number, l: number): string {
  // h: 0-360, s/l: 0-100
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h/60) % 2) - 1));
  const m = l - c/2;
  let r=0, g=0, b=0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  const toHex = (n:number) => n.toString(16).padStart(2,'0');
  return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
}

export async function POST(req: Request) {
  try {
    const { delta } = await req.json();
    const d = Number(delta);
    if (!Number.isFinite(d)) {
      return NextResponse.json({ ok: false, error: 'Invalid delta' }, { status: 400 });
    }

    // 1) Valor previo (única fila de la vista token_value)
    const { data: tv, error: errTV } = await supabase
      .from('token_value')
      .select('total_eth')
      .maybeSingle();

    if (errTV) {
      console.error('token_value error', errTV);
      // seguimos con prev=0 como fallback
    }

    const prev = Number(tv?.total_eth ?? 0);

    // 2) Ratio de impacto normalizado (amarillo -> rojo según magnitud del cambio)
    //    denom estabiliza la escala para cambios pequeños/grandes
    const denom = Math.max(1e-12, prev * 0.25 + 0.000001);
    const ratio = clamp01(Math.abs(d) / denom);

    // 3) Hue 55° (amarillo) -> 0° (rojo)
    const hue = 55 * (1 - ratio);
    const sat = 95;
    let lig = 58;

    // Si la jugada resta (delta < 0), oscurecemos un poco el rojo
    if (d < 0) lig = Math.max(35, lig - 10);

    const colorHex = hslToHex(hue, sat, lig);

    // 4) Persistimos el color
    const { error: errUpd } = await supabase
      .from('mm3_visual_state')
      .update({ color_hex: colorHex, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (errUpd) {
      console.error('mm3_visual_state update error', errUpd);
      return NextResponse.json({ ok: false, error: 'DB update failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, colorHex, prev, delta: d });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'Unexpected' }, { status: 500 });
  }
}

