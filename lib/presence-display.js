export function isAnonymousPresenceId(value) {
  const id = String(value || '').toLowerCase();
  return id.startsWith('anon-') || id.startsWith('anon:');
}

export function groupPresenceEntries(entries, getId = (entry) => entry) {
  const wallets = [];
  const anonymous = [];
  for (const entry of entries || []) {
    const id = String(getId(entry) || '');
    if (!id) continue;
    (isAnonymousPresenceId(id) ? anonymous : wallets).push(entry);
  }
  return { wallets, anonymous };
}
