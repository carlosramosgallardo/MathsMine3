export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { appendWalletDecoration, TRADING_NFTJI } from '@/lib/wallet-decorations';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(req) {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = serviceClient();
  const { data: progressRow, error: readError } = await supabase
    .from('player_progress')
    .select('wallet_emojis, zero_day_level')
    .eq('wallet', wallet)
    .maybeSingle();
  if (readError) {
    return Response.json({ ok: false, error: readError.message }, { status: 500 });
  }
  if (!progressRow) {
    return Response.json({ ok: false, error: 'no_progress' }, { status: 404 });
  }

  const nextDecorations = appendWalletDecoration(progressRow.wallet_emojis, TRADING_NFTJI.emoji);
  const nextLevel = Number(progressRow.zero_day_level ?? -1) + 1;

  const { error: updateError } = await supabase
    .from('player_progress')
    .update({
      wallet_emojis: nextDecorations,
      zero_day_level: nextLevel,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet', wallet);
  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    zero_day_level: nextLevel,
    wallet_emojis: nextDecorations,
  });
}
