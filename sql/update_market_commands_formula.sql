-- Update market_command field for all 20 mm3_market_blocks rows
-- Format: /command => arithmetic_formula_with_x = ?
-- x is the 3-digit nonce (100-799) shown in IRC exec messages
-- Users compute the formula to get the 5-digit redemption code

UPDATE mm3_market_blocks SET market_command = '/ping -c 4 gateway.mainframe => 5*(4000+x) + 12*(300+x) + (6000+3*x)/3 = ?' WHERE block_key = 'mm3-023';
UPDATE mm3_market_blocks SET market_command = '/nmcli connection reload => (7000+x) + 13*200 + x*4 = ?' WHERE block_key = 'mm3-05c';
UPDATE mm3_market_blocks SET market_command = '/netstat -tulpn => 9000 + 8*x + 3600/3 = ?' WHERE block_key = 'mm3-0b9';
UPDATE mm3_market_blocks SET market_command = '/git cherry-pick a1b2c3d => 11000 + 21*x + 1440/2 = ?' WHERE block_key = 'mm3-11b';
UPDATE mm3_market_blocks SET market_command = '/kubectl rollout restart deploy/fractal-core => 12000 + x*17 + 4096/4 = ?' WHERE block_key = 'mm3-184';
UPDATE mm3_market_blocks SET market_command = '/uptime => 15000 + x*23 + 2048/2 = ?' WHERE block_key = 'mm3-1e7';
UPDATE mm3_market_blocks SET market_command = '/journalctl -n 50 => 18000 + x*31 + 7777%1000 = ?' WHERE block_key = 'mm3-244';
UPDATE mm3_market_blocks SET market_command = '/whoami => 22000 + x*37 + 9999/3 = ?' WHERE block_key = 'mm3-26d';
UPDATE mm3_market_blocks SET market_command = '/hostnamectl status => 26000 + x*41 + 12345%678 = ?' WHERE block_key = 'mm3-2ca';
UPDATE mm3_market_blocks SET market_command = '/sha256sum /etc/hosts => 30000 + x*47 + 8192/4 = ?' WHERE block_key = 'mm3-30e';
UPDATE mm3_market_blocks SET market_command = '/lsblk => 41000 + x*11 + 2048/4 = ?' WHERE block_key = 'mm3-01d';
UPDATE mm3_market_blocks SET market_command = '/passwd => (43000+x) + 17*300 + x*3 = ?' WHERE block_key = 'mm3-04a';
UPDATE mm3_market_blocks SET market_command = '/ufw status verbose => 47000 + 19*x + 4096/8 = ?' WHERE block_key = 'mm3-091';
UPDATE mm3_market_blocks SET market_command = '/ss -lntp => 51000 + x*29 + 7776/6 = ?' WHERE block_key = 'mm3-0f8';
UPDATE mm3_market_blocks SET market_command = '/uname -r => 54000 + x*31 + 10000/8 = ?' WHERE block_key = 'mm3-15c';
UPDATE mm3_market_blocks SET market_command = '/gcc --version => 58000 + x*37 + 8192/16 = ?' WHERE block_key = 'mm3-1a6';
UPDATE mm3_market_blocks SET market_command = '/scp file.txt backup:/tmp/ => 62000 + x*43 + 12345%789 = ?' WHERE block_key = 'mm3-20b';
UPDATE mm3_market_blocks SET market_command = '/curl -I http://localhost => 68000 + x*38 + 9999/9 = ?' WHERE block_key = 'mm3-29b';
UPDATE mm3_market_blocks SET market_command = '/acpi -V => 73000 + x*32 + 16384/16 = ?' WHERE block_key = 'mm3-2da';
UPDATE mm3_market_blocks SET market_command = '/alsamixer => 79000 + x*25 + 22222%999 = ?' WHERE block_key = 'mm3-2f9';
