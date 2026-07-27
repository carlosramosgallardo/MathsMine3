export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { executeMarketCommand } from '@/lib/execute-market-command';
import { insertRelayMessage } from '@/lib/insert-relay-message';

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

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const command = String(body.command || '').trim();
  if (!command.startsWith('/')) {
    return Response.json({ ok: false, error: 'invalid_command' }, { status: 400 });
  }

  const supabase = serviceClient();
  try {
    const result = await executeMarketCommand(supabase, wallet, command);
    if (result.error === 'not_found') {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    if (result.rejected) {
      if (result.message) {
        await insertRelayMessage(supabase, {
          wallet: 'system',
          text: result.message,
          kind: 'system',
          tone: result.tone || 'command',
        });
      }
      return Response.json({
        ok: false,
        rejected: true,
        message: result.message,
        tone: result.tone,
      });
    }

    if (result.system_message?.text) {
      await insertRelayMessage(supabase, {
        wallet: 'system',
        text: result.system_message.text,
        kind: 'system',
        tone: result.system_message.tone || 'market',
      });
    }

    return Response.json({
      ok: true,
      wallets_penalized: result.wallets_penalized ?? 0,
      system_message: result.system_message,
      reset_at: result.reset_at,
    });
  } catch (err) {
    console.error('relay/market-command:', err);
    const message = `command failed >> ${err?.message || 'internal'}`;
    await insertRelayMessage(supabase, {
      wallet: 'system',
      text: message,
      kind: 'system',
      tone: 'command',
    }).catch(() => {});
    return Response.json({ ok: false, error: err?.message || 'internal', message }, { status: 500 });
  }
}
