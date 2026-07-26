package xyz.mathsmine3.nativeapp.aiteam

data class AiBot(
    val wallet: String,
    val tags: List<String>,
    val mapLabel: String,
)

data class AiPool(
    val code: String,
    val bots: List<AiBot>,
)

/** Mirrors app/ai-team/page.jsx BOT_POOLS + lib/ai-team.js. */
object AiTeamCatalog {
    val POOLS = listOf(
        AiPool(
            code = "FHNN6",
            bots = listOf(
                AiBot(
                    wallet = "0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528",
                    tags = listOf("sell_mm3", "squeeze 90%", "attack", "chain_mine"),
                    mapLabel = "M2",
                ),
                AiBot(
                    wallet = "0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202",
                    tags = listOf("buy_mm3", "squeeze 15%", "defense", "chain_mine"),
                    mapLabel = "M3",
                ),
            ),
        ),
        AiPool(
            code = "8FR49",
            bots = listOf(
                AiBot(
                    wallet = "0xd6c6c15060b27406d956c7e99e520cc810b44233",
                    tags = listOf("nftji_collect", "squeeze 55%", "balanced", "chain_mine"),
                    mapLabel = "M4",
                ),
                AiBot(
                    wallet = "0xd89413f5f444cd420b448cda3bc096ea9c46e8ab",
                    tags = listOf("nftji_flip", "squeeze 80%", "balanced", "chain_mine"),
                    mapLabel = "M5",
                ),
            ),
        ),
    )

    val ALL_WALLETS: Set<String> =
        POOLS.flatMap { pool -> pool.bots.map { it.wallet } }.toSet()

    fun shortWallet(wallet: String): String {
        val w = wallet.trim()
        if (w.length < 10) return w
        return "${w.take(6)}…${w.takeLast(4)}"
    }
}
