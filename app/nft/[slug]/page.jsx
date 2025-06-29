import supabase from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic'; 

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
          {data.wallet ? maskWallet(data.wallet) : 'Unassigned'}
        </div>
      </div>
    </div>
  );
}