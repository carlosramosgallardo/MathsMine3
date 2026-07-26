package xyz.mathsmine3.nativeapp.mining

/**
 * Incremental port map from web FPV → Filament.
 * Source of truth remains components/MiningChain3DFPV.jsx + lib/mining-*.js.
 */
object MiningPortChecklist {
    val modules = listOf(
        "Grid / cell map load from mining-snapshot",
        "Player locomotion + touch joystick",
        "Remote presence via mm3-chain3d-v1-map-{id} move events",
        "PvP hit / death → /api/pvp-hit /api/pvp-death",
        "Bosses M3/M4/M5 → /api/m3-boss|/api/m4-boss|/api/m5-boss",
        "NFTJI buy/resell → /api/mining/nftji-*",
        "Mine block → /api/mine-block",
        "Chain solve / demine",
        "Map ambient obstacles (mining-map-ambient parity)",
    )
}
