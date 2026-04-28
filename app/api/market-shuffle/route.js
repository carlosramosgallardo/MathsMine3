import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// One-time endpoint: randomises grid_row/grid_col of all active non-sold blocks.
// Sold blocks are untouched. After running once, delete this route.
// Call with: POST /api/market-shuffle?secret=YOUR_SECRET
export async function POST(req) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (!secret || secret !== process.env.MARKET_SHUFFLE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 1. Load all active non-sold blocks (these will be repositioned)
  const { data: activeBlocks, error: activeErr } = await supabase
    .from('mm3_market_blocks')
    .select('block_key, grid_row, grid_col')
    .eq('is_active', true)
    .is('claimed_by', null);

  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });
  if (!activeBlocks?.length) return NextResponse.json({ msg: 'no active blocks to shuffle', count: 0 });

  // 2. Load sold blocks to exclude their positions
  const { data: soldBlocks } = await supabase
    .from('mm3_market_blocks')
    .select('grid_row, grid_col')
    .not('claimed_by', 'is', null);

  const soldPos = new Set((soldBlocks || []).map((b) => `${b.grid_row}-${b.grid_col}`));

  // 3. All 28×28 positions minus sold ones
  const freePositions = [];
  for (let row = 0; row < 28; row++) {
    for (let col = 0; col < 28; col++) {
      if (!soldPos.has(`${row}-${col}`)) freePositions.push({ row, col });
    }
  }

  if (freePositions.length < activeBlocks.length) {
    return NextResponse.json({ error: 'not enough free positions', free: freePositions.length, needed: activeBlocks.length }, { status: 500 });
  }

  // 4. Pick random positions (no duplicates guaranteed by sampling without replacement)
  const picked = shuffle(freePositions).slice(0, activeBlocks.length);

  // 5. First clear all positions to null to avoid unique-constraint conflicts during update
  const clearResult = await supabase
    .from('mm3_market_blocks')
    .update({ grid_row: null, grid_col: null })
    .in('block_key', activeBlocks.map((b) => b.block_key));

  if (clearResult.error) return NextResponse.json({ error: clearResult.error.message }, { status: 500 });

  // 6. Assign new random positions one by one
  const log = [];
  for (let i = 0; i < activeBlocks.length; i++) {
    const { block_key } = activeBlocks[i];
    const { row, col } = picked[i];
    const hex = '#' + (row * 28 + col).toString(16).toUpperCase().padStart(3, '0');
    const { error } = await supabase
      .from('mm3_market_blocks')
      .update({ grid_row: row, grid_col: col })
      .eq('block_key', block_key);
    if (error) return NextResponse.json({ error: error.message, at: block_key }, { status: 500 });
    log.push(`${block_key} → row ${row} col ${col} = ${hex}`);
  }

  return NextResponse.json({ msg: 'shuffle complete', count: activeBlocks.length, positions: log });
}
