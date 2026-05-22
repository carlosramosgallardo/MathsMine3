import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase admin env vars');
  }

  return createClient(url, key);
}

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();

export async function POST(req) {
  try {
    const token = req.nextUrl.searchParams.get('token');

    if (token !== process.env.ALCHEMY_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const payload = await req.json();
    const activities = payload?.event?.activity || [];

    let inserted = 0;

    for (const tx of activities) {
      const fromAddress = tx.fromAddress?.toLowerCase();
      const toAddress = tx.toAddress?.toLowerCase();
      const amount = Math.abs(Number(tx.value || 0));
      const asset = tx.asset || 'UNKNOWN';
      const hash = tx.hash;

      if (!ADMIN_WALLET || toAddress !== ADMIN_WALLET) continue;
      if (!hash || amount <= 0) continue;

      if (asset === 'ETH' && amount < 0.00001) continue;
      if (asset === 'USDC' && amount < 0.01) continue;

      const now = Date.now();
      const shortHash = `${hash.slice(0, 10)}...${hash.slice(-6)}`;
      const isSelf = fromAddress === ADMIN_WALLET && toAddress === ADMIN_WALLET;

      const message = isSelf
        ? `Self injection → ${amount} ${asset} recycled into MM3 mainframe :: tx ${shortHash}`
        : `Donation detected → ${amount} ${asset} injected into MM3 mainframe :: tx ${shortHash}`;

      const ircPayload = {
        id: `realchain:${hash}:${now}`,
        wallet: 'realchain',
        text: message,
        ts: now,
        kind: 'system',
        tone: 'realchain',
      };

      const { error: insertError } = await supabase.from('mm3_relaying_messages').insert({
        wallet: ircPayload.wallet,
        text: ircPayload.text,
        ts: ircPayload.ts,
        kind: ircPayload.kind,
        tone: ircPayload.tone,
      });

      if (insertError) {
        throw insertError;
      }

      await supabase.channel('mm3-irc-relay').send({
        type: 'broadcast',
        event: 'message',
        payload: ircPayload,
      });

      inserted += 1;
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (error) {
    console.error('[alchemy webhook]', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}