import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h per chip

async function getChipStatus(chip) {
  const { data } = await supabaseAdmin
    .from('mm3_chain_reset_log')
    .select('created_at')
    .eq('chip', chip)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { active: false, resetsAt: null };

  const createdAt = new Date(data.created_at).getTime();
  const resetsAt = createdAt + COOLDOWN_MS;
  const now = Date.now();

  if (now < resetsAt) return { active: true, resetsAt };
  return { active: false, resetsAt: null };
}

export async function GET() {
  try {
    const [chip1, chip2] = await Promise.all([getChipStatus(1), getChipStatus(2)]);
    return NextResponse.json({ chip1, chip2 });
  } catch (err) {
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { chip, wallet } = await request.json();
    const chipNum = Number(chip);
    if (chipNum !== 1 && chipNum !== 2) {
      return NextResponse.json({ error: 'invalid_chip' }, { status: 400 });
    }

    const status = await getChipStatus(chipNum);
    if (status.active) {
      return NextResponse.json({ error: 'cooldown_active', resetsAt: status.resetsAt }, { status: 429 });
    }

    // Delete only mm3_mined_blocks (chain blocks), NOT mm3_mining_blocks (NFTJI market)
    const { error: delErr } = await supabaseAdmin
      .from('mm3_mined_blocks')
      .delete()
      .neq('id', 0); // delete all rows

    if (delErr) {
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    }

    // Log the reset
    const walletVal = String(wallet || 'anon').toLowerCase() || 'anon';
    await supabaseAdmin.from('mm3_chain_reset_log').insert({
      chip: chipNum,
      wallet: walletVal,
    });

    // Insert kernel panic trace into relaying terminal
    const traceEn = `KERNEL PANIC >> /rm -rf MM3_BLOCK_CHAIN executed >> chip #${chipNum} >> wallet=${walletVal} >> mm3_mined_blocks wiped >> chain reset at ${new Date().toISOString()} >> 24h cooldown started`;
    const traceEs = `KERNEL PANIC >> /rm -rf MM3_BLOCK_CHAIN ejecutado >> chip #${chipNum} >> wallet=${walletVal} >> mm3_mined_blocks borrado >> cadena reseteada ${new Date().toISOString()} >> cooldown 24h iniciado`;

    await supabaseAdmin.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text: traceEn,
      ts: Date.now(),
      kind: 'system',
      tone: 'realchain',
    });

    return NextResponse.json({ ok: true, trace_en: traceEn, trace_es: traceEs });
  } catch (err) {
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
