import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();

export async function POST(req) {
  try {
    const token = req.nextUrl.searchParams.get('token');

    if (token !== process.env.ALCHEMY_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const activities = payload?.event?.activity || [];

    for (const tx of activities) {
      const toAddress = tx.toAddress?.toLowerCase();
      const amount = Number(tx.value || 0);
      const asset = tx.asset || 'UNKNOWN';
      const hash = tx.hash;

      if (!ADMIN_WALLET || toAddress !== ADMIN_WALLET) continue;
      if (!hash || amount <= 0) continue;

      // Anti-spam thresholds
      if (asset === 'ETH' && amount < 0.00001) continue;
      if (asset === 'USDC' && amount < 0.01) continue;

      const shortHash = `${hash.slice(0, 10)}...${hash.slice(-6)}`;

      const message = `[REALCHAIN] Donation detected → ${amount} ${asset} injected into MM3 mainframe :: tx ${shortHash}`;

      await supabase.from('mm3_irc_messages').insert({
        wallet: 'realchain',
        text: message,
        ts: Date.now(),
        kind: 'system',
        tone: 'realchain',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[alchemy webhook]', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
