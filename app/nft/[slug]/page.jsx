import supabase from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// Deterministic color from wallet address (same rule used elsewhere)
function colorFromAddress(addr = '') {
  const s = (addr || '').toLowerCase().replace(/^0x/, '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const h = hash % 360;   // hue 0..359
  const sat = 70;         // %
  const light = 55;       // %
  return hslToHex(h, sat, light);
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

export default async function NFTPage({ params }) {
  const { slug } = params;

  const { data, error } = await supabase
    .from('computed_user_nfts')
    .select('nft_slug, name, description, image_url, rarity, wallet')
    .eq('nft_slug', slug)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="text-center mt-20 text-[#e11d48] font-mono">
        NFT not found or currently unassigned.
      </div>
    );
  }

  const maskWallet = (wallet) =>
    wallet ? `${wallet.slice(0, 5)}...${wallet.slice(-5)}` : '—';

  const ownerWallet = data.wallet || '';
  const ownerColor = ownerWallet ? colorFromAddress(ownerWallet) : '#94a3b8'; // fallback slate-400

  return (
    <div className="flex flex-col items-center pt-10 pb-16 text-[#22d3ee] bg-[#0b0f19] px-4">
      <div className="max-w-md w-full bg-[#1e293b] p-6 rounded-xl shadow-lg text-center">
        <img
          src={data.image_url}
          alt={data.nft_slug}
          className="w-48 h-48 mx-auto mb-4 rounded-lg"
        />
        <h1 className="text-xl font-semibold mt-8 mb-2">{data.name}</h1>
        <p className="text-sm text-gray-400 mb-4">{data.description}</p>

        <div className="text-sm font-mono">
          <span className="text-gray-400">Rarity:</span> {data.rarity}
        </div>

        <div className="text-sm font-mono mt-1">
          <span className="text-gray-400">Owner:</span>{' '}
          {ownerWallet ? (
            <span style={{ color: ownerColor, fontWeight: 600 }}>
              {maskWallet(ownerWallet)}
            </span>
          ) : (
            'Unassigned'
          )}
        </div>
      </div>
    </div>
  );
}
