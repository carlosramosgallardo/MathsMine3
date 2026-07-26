package xyz.mathsmine3.nativeapp.daily

import org.json.JSONObject
import xyz.mathsmine3.nativeapp.data.SupabaseRest
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

data class DailyTaskDef(
    val key: String,
    val section: String,
    val target: Int,
    val rewardEur: Double,
)

data class UtcDayBounds(
    val startIso: String,
    val endIso: String,
    val dayKey: String,
)

data class DailyProgress(
    val counts: Map<String, Int>,
    val claimed: Map<String, Boolean>,
    val dayKey: String,
    val pendingRewards: Int,
)

object DailyTasks {
    val CATALOG = listOf(
        DailyTaskDef("training", "Training", 25, 0.25),
        DailyTaskDef("trading", "Trading", 5, 0.50),
        DailyTaskDef("mining", "Mining", 1, 0.75),
        DailyTaskDef("mining_chain", "Mining", 1, 10.0),
        DailyTaskDef("pvp_hit", "Mining", 1, 100.0),
        DailyTaskDef("relaying", "Relaying", 1, 1.0),
        DailyTaskDef("relayingHidden", "Relaying", 1, 5.0),
        DailyTaskDef("squeezing", "Squeezing", 5, 2.5),
    )

    private const val CNY_TO_EUR = 0.128
    private const val CNY_TO_USD = 0.139

    fun utcDayBounds(now: Instant = Instant.now()): UtcDayBounds {
        val date = now.atZone(ZoneOffset.UTC).toLocalDate()
        val start = date.atStartOfDay().toInstant(ZoneOffset.UTC)
        val end = date.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC)
        return UtcDayBounds(
            startIso = DateTimeFormatter.ISO_INSTANT.format(start),
            endIso = DateTimeFormatter.ISO_INSTANT.format(end),
            dayKey = date.toString(),
        )
    }

    fun rolling24h(now: Instant = Instant.now()): Pair<String, String> {
        val end = now
        val start = now.minusSeconds(24 * 60 * 60)
        return DateTimeFormatter.ISO_INSTANT.format(start) to DateTimeFormatter.ISO_INSTANT.format(end)
    }

    fun formatReward(rewardEur: Double, currency: String): String {
        val value = when (currency.uppercase()) {
            "USD" -> rewardEur * (CNY_TO_USD / CNY_TO_EUR)
            "CNY" -> rewardEur / CNY_TO_EUR
            else -> rewardEur
        }
        val symbol = when (currency.uppercase()) {
            "USD" -> "$"
            "CNY" -> "¥"
            else -> "€"
        }
        return "$symbol${"%.2f".format(java.util.Locale.US, value)}"
    }

    fun taskName(key: String, es: Boolean): String = when (key) {
        "training" -> "TRAINING"
        "trading" -> "TRADING"
        "mining" -> "MINING"
        "mining_chain" -> "MINING CHAIN"
        "pvp_hit" -> if (es) "CAZADOR ENEMIGO" else "ENEMY HUNTER"
        "relaying" -> "RELAYING (PUBLIC)"
        "relayingHidden" -> "RELAYING (SECRET)"
        "squeezing" -> "SQUEEZING"
        else -> key.uppercase()
    }

    fun taskHint(key: String, es: Boolean): String = when (key) {
        "training" -> if (es) "Resuelve 25 problemas matemáticos" else "Solve 25 math problems"
        "trading" -> if (es) "Realiza 5 operaciones de compra/venta" else "Execute 5 buy/sell operations"
        "mining" -> if (es) "Compra o revende 1 NFTJI" else "Buy or resell 1 NFTJI"
        "mining_chain" -> if (es) "Extrae 1 bloque de la MM3 Block Chain" else "Mine 1 MM3 Block Chain"
        "pvp_hit" -> if (es) {
            "Elimina 1 wallet enemiga (mata o lidera el daño)"
        } else {
            "Eliminate 1 enemy wallet (kill or top-damage assist)"
        }
        "relaying" -> if (es) "Lanza un comando" else "Launch a command"
        "relayingHidden" -> if (es) "Lanza un comando oculto" else "Launch a hidden command"
        "squeezing" -> if (es) "Lanza 5 Squeezes contra pools" else "Launch 5 Squeezes against pools"
        else -> key
    }

    fun sectionAccent(section: String): Long = when (section) {
        "Mining" -> 0xFF22D3EE
        "Squeezing" -> 0xFFA855F7
        "Relaying" -> 0xFFFB923C
        "Trading" -> 0xFF4ADE80
        "Training" -> 0xFFF59E0B
        else -> 0xFF64748B
    }

    private fun enc(iso: String): String =
        URLEncoder.encode(iso, StandardCharsets.UTF_8.name())

    fun loadProgress(supabase: SupabaseRest, walletValue: String): DailyProgress {
        val wallet = walletValue.lowercase()
        if (wallet.isBlank() || !supabase.configured) {
            return DailyProgress(emptyMap(), emptyMap(), "", 0)
        }
        val bounds = utcDayBounds()
        val (rollStart, rollEnd) = rolling24h()
        val start = enc(bounds.startIso)
        val end = enc(bounds.endIso)
        val rStart = enc(rollStart)
        val rEnd = enc(rollEnd)

        val training = supabase.count(
            "games",
            "wallet=eq.$wallet&is_correct=eq.true&created_at=gte.$start&created_at=lt.$end",
        )
        val trading = supabase.count(
            "mm3_sell_transactions",
            "wallet=eq.$wallet&created_at=gte.$start&created_at=lt.$end",
        )
        val mining = supabase.count(
            "mm3_mining_events",
            "wallet=eq.$wallet&event_type=in.(mining_buy,mining_resell)&created_at=gte.$start&created_at=lt.$end",
        )
        val relaying = supabase.count(
            "mm3_mining_commands",
            "wallet=eq.$wallet&executed_at=gte.$start&executed_at=lt.$end",
        )
        val squeezing = supabase.count(
            "mm3_squeezing_launches",
            "wallet=eq.$wallet&created_at=gte.$rStart&created_at=lt.$rEnd",
        )
        val hidden = supabase.count(
            "mm3_hidden_cmd_executions",
            "wallet=eq.$wallet&executed_at=gte.$start&executed_at=lt.$end",
        )
        val chain = supabase.count(
            "mm3_mined_blocks",
            "wallet=eq.$wallet&mined_at=gte.$start&mined_at=lt.$end",
        )
        val pvpRows = supabase.select(
            "mm3_pvp_hits",
            filter = "attacker_wallet=eq.$wallet&day_key=eq.${bounds.dayKey}",
            columns = "elim_count",
            limit = 500,
        )
        var pvpHits = 0
        for (i in 0 until pvpRows.length()) {
            pvpHits += pvpRows.getJSONObject(i).optInt("elim_count", 0)
        }
        val claimsRows = supabase.select(
            "daily_task_claims",
            filter = "wallet=eq.$wallet&day=eq.${bounds.dayKey}",
            columns = "task_key,reward_claimed,claimed_at",
            limit = 50,
        )
        val claimed = mutableMapOf<String, Boolean>()
        for (i in 0 until claimsRows.length()) {
            val row = claimsRows.getJSONObject(i)
            val key = row.optString("task_key")
            if (key.isNotBlank()) claimed[key] = row.optBoolean("reward_claimed", true)
        }

        val counts = mapOf(
            "training" to training,
            "trading" to trading,
            "mining" to mining,
            "relaying" to relaying,
            "squeezing" to squeezing,
            "relayingHidden" to hidden,
            "mining_chain" to chain,
            "pvp_hit" to pvpHits,
        )
        val pending = CATALOG.count { task ->
            (counts[task.key] ?: 0) >= task.target && claimed[task.key] != true
        }
        return DailyProgress(counts, claimed, bounds.dayKey, pending)
    }
}
