export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import {
  blockHexToGrid,
  buildBlockChainCode,
  doesGlobalValueMeetRequirement,
  formatBlockRequirement,
  MM3_BLOCK_REQUIREMENT_BY_HEX,
  MM3_BLOCK_CHAIN_REQUIREMENTS,
  mm3ValueToHex,
  normalizeBlockHex,
} from '@/lib/mm3-block-chain';
import { formatWalletLabel } from '@/lib/wallet-format';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  const blockHex = normalizeBlockHex(body.blockHex);
  const requirement = MM3_BLOCK_REQUIREMENT_BY_HEX.get(blockHex);

  if (!wallet || !blockHex) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  if (!requirement) {
    return Response.json({ ok: false, error: 'block_not_mineable', blockHex }, { status: 400 });
  }

  const grid = blockHexToGrid(blockHex);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const [{ data: reservedBlock }, { data: existing }, { data: progress }, { data: tokenValue }] = await Promise.all([
      supabase
        .from('mm3_market_blocks')
        .select('block_key, emoji')
        .eq('grid_row', grid.row)
        .eq('grid_col', grid.col)
        .maybeSingle(),
      supabase
        .from('mm3_mined_blocks')
        .select('block_hex, wallet')
        .eq('block_hex', blockHex)
        .maybeSingle(),
      supabase
        .from('player_progress')
        .select('level')
        .eq('wallet', wallet)
        .maybeSingle(),
      supabase
        .from('token_value')
        .select('total_eth')
        .maybeSingle(),
    ]);

    if (reservedBlock) {
      return Response.json({ ok: false, error: 'reserved_market_nftji', blockHex }, { status: 409 });
    }
    if (existing) {
      return Response.json({ ok: false, error: 'already_mined', blockHex, owner: existing.wallet }, { status: 409 });
    }

    const walletLevel = Number(progress?.level) || 0;
    const globalMm3 = Number(tokenValue?.total_eth) || 0;
    const hasLevel = walletLevel >= requirement.minLevel;
    const hasValue = doesGlobalValueMeetRequirement(globalMm3, requirement.requiredMm3);
    if (!hasLevel || !hasValue) {
      return Response.json({
        ok: false,
        error: 'requirements_not_met',
        blockHex,
        requirement: formatBlockRequirement(requirement),
        walletLevel,
        globalMm3,
      }, { status: 403 });
    }

    const { data: last } = await supabase
      .from('mm3_mined_blocks')
      .select('chain_index')
      .order('chain_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const chainIndex = (Number(last?.chain_index) || 0) + 1;
    const { data: mined, error: insertError } = await supabase
      .from('mm3_mined_blocks')
      .insert({
        block_hex: blockHex,
        grid_row: grid.row,
        grid_col: grid.col,
        wallet,
        wallet_level: walletLevel,
        mm3_value: globalMm3,
        mm3_value_hex: mm3ValueToHex(globalMm3),
        chain_index: chainIndex,
      })
      .select('*')
      .single();

    if (insertError?.code === '23505') {
      return Response.json({ ok: false, error: 'already_mined', blockHex }, { status: 409 });
    }
    if (insertError) throw insertError;

    const { data: chainRows } = await supabase
      .from('mm3_mined_blocks')
      .select('block_hex, wallet, mm3_value_hex, chain_index')
      .order('chain_index', { ascending: true });
    const chain = chainRows || [mined];
    const percent = MM3_BLOCK_CHAIN_REQUIREMENTS.length > 0
      ? Math.round((chain.length / MM3_BLOCK_CHAIN_REQUIREMENTS.length) * 10000) / 100
      : 0;
    const walletMinedCount = chain.filter((row) => normalizeWallet(row.wallet) === wallet).length;
    const walletPercent = MM3_BLOCK_CHAIN_REQUIREMENTS.length > 0
      ? Math.round((walletMinedCount / MM3_BLOCK_CHAIN_REQUIREMENTS.length) * 10000) / 100
      : 0;
    const code = buildBlockChainCode(chain);
    const ts = Date.now();
    const trace = `MM3 BLOCK CHAIN IN PROGRESS >> mined ${blockHex} by ${formatWalletLabel(wallet)} >> ${chain.length}/${MM3_BLOCK_CHAIN_REQUIREMENTS.length} ${percent.toFixed(2)}% >> ${code}`;

    await supabase
      .from('player_progress')
      .upsert({ wallet, block_chain_percent: walletPercent, updated_at: new Date().toISOString() }, { onConflict: 'wallet' });

    await supabase.from('mm3_irc_messages').insert({
      wallet: 'system',
      text: trace,
      ts,
      kind: 'system',
      tone: 'market',
    });

    return Response.json({ ok: true, mined, trace, percent, code });
  } catch (error) {
    console.error('mine block error:', error);
    const missingTable = error?.code === '42P01';
    return Response.json({ ok: false, error: missingTable ? 'block_chain_not_installed' : 'db_error' }, { status: missingTable ? 501 : 500 });
  }
}
