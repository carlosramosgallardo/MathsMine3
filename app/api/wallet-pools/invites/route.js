import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.toLowerCase().trim();

  if (!wallet) {
    return NextResponse.json({ ok: false, error: 'Missing wallet parameter' }, { status: 400 });
  }

  try {
    // Fetch pending invitations for this wallet
    const { data: invites, error } = await supabase
      .from('mm3_wallet_pool_invitations')
      .select(`
        id,
        invited_by,
        pool_code,
        created_at,
        mm3_wallet_pools!inner(created_by)
      `)
      .eq('wallet', wallet)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invites:', error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      invites: invites || []
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}