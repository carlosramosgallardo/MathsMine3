-- ============================================================
-- MATHSMINE3 — sync public Market command metadata
--
-- This only writes public command formulas into mm3_market_blocks.
-- Hidden command strings are intentionally not included here.
-- ============================================================

BEGIN;

UPDATE public.mm3_market_blocks AS b
SET market_command = v.market_command,
    formula_x = 123,
    formula_result_5d = v.formula_result_5d,
    updated_at = NOW()
FROM (
  VALUES
    ('mm3-023', '/wall [freakingAI@MM3] solve => (log10(100000)*(4000+x))+(12*(300+x))+((6000+3*x)/3) = ?', '27814'),
    ('mm3-05c', '/wall [freakingAI@MM3] solve => (7000+x)+(13*200)+(x*4) = ?', '10215'),
    ('mm3-0b9', '/wall [freakingAI@MM3] solve => 9000+(8*x)+(3600/3) = ?', '11184'),
    ('mm3-11b', '/wall [freakingAI@MM3] solve => 11000+(21*x)+(1440/2) = ?', '14303'),
    ('mm3-184', '/wall [freakingAI@MM3] solve => (12000+x*17)+(4096/4) = ?', '15115'),
    ('mm3-1e7', '/wall [freakingAI@MM3] solve => 15000+(x*23)+(2048/2) = ?', '18853'),
    ('mm3-244', '/wall [freakingAI@MM3] solve => 18000+(x*31)+(7777%1000) = ?', '22590'),
    ('mm3-26d', '/wall [freakingAI@MM3] solve => 22000+(x*37)+(9999/3) = ?', '29884'),
    ('mm3-2ca', '/wall [freakingAI@MM3] solve => 26000+(x*41)+(12345%678) = ?', '31184'),
    ('mm3-30e', '/wall [freakingAI@MM3] solve => 30000+(x*47)+(8192/4) = ?', '37829'),
    ('mm3-01d', '/mm3 [freakingAI@MM3] siphon => 41000+(x*11)+(2048/4) = ?', '42865'),
    ('mm3-04a', '/mm3 [freakingAI@MM3] siphon => (43000+x)+(17*300)+(x*3) = ?', '48592'),
    ('mm3-091', '/mm3 [freakingAI@MM3] siphon => 47000+(19*x)+(4096/8) = ?', '49849'),
    ('mm3-0f8', '/mm3 [freakingAI@MM3] siphon => 51000+(x*29)+(7776/6) = ?', '55863'),
    ('mm3-15c', '/mm3 [freakingAI@MM3] siphon => (54000+x*31)+(10000/8) = ?', '59063'),
    ('mm3-1a6', '/mm3 [freakingAI@MM3] siphon => 58000+(x*37)+(8192/16) = ?', '63063'),
    ('mm3-20b', '/mm3 [freakingAI@MM3] siphon => 62000+(x*43)+(12345%789) = ?', '67799'),
    ('mm3-29b', '/mm3 [freakingAI@MM3] siphon => 68000+(x*53)+(9999/9) = ?', '75630'),
    ('mm3-2da', '/mm3 [freakingAI@MM3] siphon => 73000+(x*59)+(16384/16) = ?', '81281'),
    ('mm3-2f9', '/mm3 [freakingAI@MM3] siphon => 79000+(x*67)+(22222%999) = ?', '87485')
) AS v(block_key, market_command, formula_result_5d)
WHERE b.block_key = v.block_key;

COMMIT;
