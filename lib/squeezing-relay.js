export function formatSqueezeIrcSummary(dispute, event = 'resolved') {
  const ch = dispute?.challenger_pool_code || '?????';
  const df = dispute?.defender_pool_code || '?????';
  const id = dispute?.id ? `#${dispute.id}` : '#?';
  if (event === 'cancelled') {
    return `${id} cancelled :: ${ch} vs ${df} :: not enough wallets`;
  }

  const summary = dispute?.result_summary || {};
  const winner = String(dispute?.winner || summary.winner || 'unknown');
  const chScore = Number(dispute?.ch_score ?? summary.ch_score ?? 0).toFixed(4);
  const dfScore = Number(dispute?.df_score ?? summary.df_score ?? 0).toFixed(4);
  const transfer = Number(summary.transfer_eur || 0).toFixed(4);
  const drop = dispute?.drop_type || summary.drop_type || '';
  return `${id} resolved :: ${ch} ${chScore} vs ${df} ${dfScore} :: winner ${winner} :: transfer ${transfer} EUR${drop ? ` :: drop ${drop}` : ''}`;
}

export async function insertSqueezeIrcTrace(supabase, dispute, event = 'resolved') {
  const text = formatSqueezeIrcSummary(dispute, event);
  const ts = Date.now();
  const payload = {
    id: `db:system:${ts}`,
    wallet: 'system',
    text,
    ts,
    kind: 'system',
    tone: 'squeeze',
  };

  const { error: insertError } = await supabase.from('mm3_relaying_messages').insert({
    wallet: payload.wallet,
    text: payload.text,
    ts: payload.ts,
    kind: payload.kind,
    tone: payload.tone,
  });
  if (insertError) {
    console.error('[squeeze-irc] insert failed:', insertError.message, insertError);
  }
}
