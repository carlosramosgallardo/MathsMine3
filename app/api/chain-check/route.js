export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { checkAndAwardChainWinner } from '@/lib/chain-winner';

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/

export async function POST(req) {
  let body = {}
  try { body = await req.json() } catch {}

  const wallet = String(body.wallet || '').trim()
  if (!WALLET_RE.test(wallet)) {
    return Response.json({ ok: false, error: 'wallet required' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  try {
    const result = await checkAndAwardChainWinner(supabase);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ ok: false, error: err?.message || 'chain check failed' }, { status: 500 });
  }
}
