import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

function maskWallet(wallet) {
  if (!wallet || wallet.length <= 10) return wallet
  return wallet.slice(0, 5) + '...' + wallet.slice(-5)
}

export async function GET() {
  const { data, error } = await supabase
    .from('polls')
    .select('id, question, wallet_address')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const maskedData = data.map(poll => ({
    ...poll,
    wallet_address: maskWallet(poll.wallet_address)
  }))

  return new Response(JSON.stringify(maskedData), { status: 200 })
}
