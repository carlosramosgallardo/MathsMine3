export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { SQUEEZE_NFTJIS } from '@/lib/wallet-decorations';
import { getDiceState } from '@/lib/dice';

export async function POST(req) {
  const { disputeId, wallet } = await req.json();

  if (!disputeId || !wallet) {
    return Response.json({ ok: false, error: 'missing_params' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.rpc('mm3_squeeze_nftji_take', {
      p_dispute_id: disputeId,
      p_wallet: wallet,
    });

    if (error) throw error;
    if (data?.error) return Response.json({ ok: false, error: data.error }, { status: 400 });

    const dropType = data.drop_type;
    if (dropType === 'attack' || dropType === 'defense') {
      const { data: tokenRow } = await supabase
        .from('token_value')
        .select('total_eth')
        .limit(1)
        .maybeSingle();
      const totalMm3 = Number(tokenRow?.total_eth) || 0;
      const shouldFlip =
        (dropType === 'attack' && totalMm3 < 0) ||
        (dropType === 'defense' && totalMm3 > 0);
      if (shouldFlip) {
        const liveDice = getDiceState();
        const dm = liveDice.active ? liveDice.modifier : 0;
        await supabase.from('mm3_market_events').insert({
          wallet,
          event_type: 'nftji_claim',
          delta_mm3: -2 * totalMm3 * (1 + dm),
          emoji: dropType === 'attack' ? SQUEEZE_NFTJIS.sword : SQUEEZE_NFTJIS.shield,
        });
      }
    }

    return Response.json({ ok: true, ...data });
  } catch (err) {
    console.error('claim-nftji-drop error:', err);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }
}
