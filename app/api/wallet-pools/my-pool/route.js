export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.toLowerCase().trim();
  if (!wallet) return NextResponse.json({ ok: false, pool_code: null });
  try {
    const { data } = await supabase
      .from('mm3_wallet_pool_members')
      .select('pool_code')
      .eq('wallet', wallet)
      .maybeSingle();
    return NextResponse.json({ ok: true, pool_code: data?.pool_code || null });
  } catch {
    return NextResponse.json({ ok: false, pool_code: null });
  }
}
