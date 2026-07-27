const MAX_TEXT = 2000;

/** Persist a row in mm3_relaying_messages (service-role client). */
export async function insertRelayMessage(supabase, {
  wallet = 'system',
  text,
  kind = 'system',
  tone = 'neutral',
  ts,
} = {}) {
  const safeText = String(text ?? '').trim();
  if (!safeText || safeText.length > MAX_TEXT) return { error: 'invalid_text' };

  const safeTs = Number.isFinite(Number(ts)) && Number(ts) > 0 ? Math.floor(Number(ts)) : Date.now();
  const safeWallet = wallet === 'system' ? 'system' : String(wallet || '').toLowerCase();

  const { error } = await supabase.from('mm3_relaying_messages').insert({
    wallet: safeWallet,
    text: safeText,
    ts: safeTs,
    kind: String(kind || 'system'),
    tone: String(tone || 'neutral'),
  });
  return { error };
}
