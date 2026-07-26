package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.SupabaseRest
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.trading.SellQuotes
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.header.formatMm3
import xyz.mathsmine3.nativeapp.ui.header.formatMoney
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import xyz.mathsmine3.nativeapp.ui.theme.RankTiers
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

private const val MIN_TRADE_MM3 = 0.00001
private const val DAILY_TX_CAP = 5
private const val TX_PAGE_SIZE = 10
private const val CNY_TO_EUR = 0.128
private const val CNY_TO_USD = 0.139

private data class TradeTx(
    val id: Long,
    val createdAt: String,
    val level: Int,
    val source: String,
    val mm3Amount: Double,
    val mm3Commission: Double,
    val commissionRate: Double,
    val rateCny: Double,
    val grossEur: Double,
    val grossUsd: Double,
    val grossCny: Double,
    val netEur: Double,
    val netUsd: Double,
    val netCny: Double,
    val commissionEur: Double,
    val commissionUsd: Double,
    val commissionCny: Double,
)

private data class TradeReload(
    val level: Int,
    val sold: Double,
    val eur: Double,
    val usd: Double,
    val cny: Double,
    val available: Double,
    val decorations: List<String>,
    val daily: Int,
    val source: String,
)

@Composable
fun TradingScreen(
    session: Session,
    api: Mm3Api,
    supabase: SupabaseRest,
    currency: String = "EUR",
) {
    val scope = rememberCoroutineScope()
    val wallet = session.wallet?.lowercase()

    var mode by remember { mutableStateOf("sell") }
    var level by remember { mutableIntStateOf(0) }
    var availableMm3 by remember { mutableStateOf(0.0) }
    var soldMm3 by remember { mutableStateOf(0.0) }
    var eurEarned by remember { mutableStateOf(0.0) }
    var usdEarned by remember { mutableStateOf(0.0) }
    var cnyEarned by remember { mutableStateOf(0.0) }
    var ratio by remember { mutableFloatStateOf(0f) }
    var message by remember { mutableStateOf("Connect wallet to trade") }
    var busy by remember { mutableStateOf(false) }
    var showLog by remember { mutableStateOf(false) }
    var dailyTx by remember { mutableIntStateOf(0) }
    var decorations by remember { mutableStateOf(listOf<String>()) }
    var source by remember { mutableStateOf("wallet") }

    var transactions by remember { mutableStateOf(listOf<TradeTx>()) }
    var txLoading by remember { mutableStateOf(false) }
    var txPage by remember { mutableIntStateOf(1) }
    var txTotal by remember { mutableIntStateOf(0) }

    val tier = RankTiers.forLevel(level)
    val tradeAmount = if (mode == "sell") availableMm3 * ratio else 0.0
    val zeroCommission = decorations.any { it.contains("revive") || it == "💀" || it == "❤️‍🩹" }
    val quote = SellQuotes.getSellQuote(level, tradeAmount, zeroCommission = zeroCommission)
    val rateDisplay = SellQuotes.rateByCurrency(level, currency)
    val totalPages = max(1, (txTotal + TX_PAGE_SIZE - 1) / TX_PAGE_SIZE)

    fun dayStartIso(): String {
        val start = Instant.now().atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay().toInstant(ZoneOffset.UTC)
        return DateTimeFormatter.ISO_INSTANT.format(start)
    }

    fun loadTransactions(page: Int = txPage) {
        if (wallet == null || !supabase.configured) return
        txLoading = true
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val total = supabase.count("mm3_sell_transactions", "wallet=eq.$wallet")
                    val offset = (page - 1) * TX_PAGE_SIZE
                    val rows = supabase.select(
                        "mm3_sell_transactions",
                        filter = "wallet=eq.$wallet",
                        columns = "id,created_at,level,source,mm3_amount,mm3_commission,commission_rate,rate_cny," +
                            "gross_cny,gross_eur,gross_usd,net_cny,net_eur,net_usd," +
                            "commission_cny,commission_eur,commission_usd",
                        order = "created_at.desc",
                        limit = TX_PAGE_SIZE,
                        offset = offset,
                    )
                    val list = buildList {
                        for (i in 0 until rows.length()) {
                            val r = rows.getJSONObject(i)
                            add(
                                TradeTx(
                                    id = r.optLong("id"),
                                    createdAt = r.optString("created_at"),
                                    level = r.optInt("level"),
                                    source = r.optString("source"),
                                    mm3Amount = r.optDouble("mm3_amount"),
                                    mm3Commission = r.optDouble("mm3_commission"),
                                    commissionRate = r.optDouble("commission_rate"),
                                    rateCny = r.optDouble("rate_cny"),
                                    grossEur = r.optDouble("gross_eur"),
                                    grossUsd = r.optDouble("gross_usd"),
                                    grossCny = r.optDouble("gross_cny"),
                                    netEur = r.optDouble("net_eur"),
                                    netUsd = r.optDouble("net_usd"),
                                    netCny = r.optDouble("net_cny"),
                                    commissionEur = r.optDouble("commission_eur"),
                                    commissionUsd = r.optDouble("commission_usd"),
                                    commissionCny = r.optDouble("commission_cny"),
                                ),
                            )
                        }
                    }
                    total to list
                }
            }
            result.onSuccess { (total, list) ->
                txTotal = total
                transactions = list
                txPage = page
            }.onFailure {
                message = it.message ?: "TX.LOG load failed"
            }
            txLoading = false
        }
    }

    fun reload() {
        if (wallet == null) {
            message = "Connect wallet to trade"
            return
        }
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val progress = if (supabase.configured) {
                        supabase.selectOne("player_progress", "wallet=eq.$wallet")
                    } else null
                    val nextLevel = progress?.optInt("level", 0) ?: 0
                    val nextSold = progress?.optDouble("mm3_sold", 0.0) ?: 0.0
                    val nextEur = progress?.optDouble("eur_earned", 0.0) ?: 0.0
                    val nextUsd = progress?.optDouble("usd_earned", 0.0) ?: 0.0
                    val nextCny = progress?.optDouble("cny_earned", 0.0) ?: 0.0
                    val mined = if (supabase.configured) {
                        supabase.selectOne("leaderboard_data", "wallet=eq.$wallet", "total_eth")
                            ?.optDouble("total_eth", 0.0) ?: 0.0
                    } else 0.0
                    val nextAvailable = max(0.0, mined - nextSold)
                    val arr = progress?.optJSONArray("wallet_emojis")
                    val nextDecorations = buildList {
                        if (arr != null) for (i in 0 until arr.length()) add(arr.optString(i))
                    }
                    runCatching { api.tokenValue().readText() }
                    val nextDaily = if (supabase.configured) {
                        min(
                            DAILY_TX_CAP,
                            supabase.count(
                                "mm3_sell_transactions",
                                "wallet=eq.$wallet&created_at=gte.${dayStartIso()}",
                            ),
                        )
                    } else 0
                    val nextSource = if (wallet.startsWith("0x")) "wallet" else "google"
                    TradeReload(
                        nextLevel, nextSold, nextEur, nextUsd, nextCny,
                        nextAvailable, nextDecorations, nextDaily, nextSource,
                    )
                }
            }
            result.onSuccess { snap ->
                level = snap.level
                soldMm3 = snap.sold
                eurEarned = snap.eur
                usdEarned = snap.usd
                cnyEarned = snap.cny
                availableMm3 = snap.available
                decorations = snap.decorations
                dailyTx = snap.daily
                source = snap.source
                message = when {
                    snap.available < MIN_TRADE_MM3 -> "No MM3 available to sell"
                    snap.daily >= DAILY_TX_CAP -> "Daily TX limit reached (#$DAILY_TX_CAP)"
                    else -> "Ready"
                }
            }.onFailure {
                message = it.message ?: "load failed"
            }
            if (showLog) loadTransactions(txPage)
        }
    }

    LaunchedEffect(wallet) { reload() }

    Mm3Screen(
        title = "TRADING",
        subtitle = "${tier.emoji} Lv $level · ${"%.8f".format(Locale.US, availableMm3)} MM3",
    ) {
        Mm3Panel(accent = tier.color) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Mm3Button(
                    text = "SELL",
                    onClick = { mode = "sell" },
                    accent = tier.color,
                    filled = mode == "sell",
                    modifier = Modifier.weight(1f),
                )
                Mm3Button(
                    text = "BUY",
                    onClick = {
                        mode = "buy"
                        message = "Buy — use portal web for full buy flow; sell is native"
                    },
                    accent = tier.color,
                    filled = mode == "buy",
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                "NFTJI · ${if (decorations.isEmpty()) "none" else decorations.joinToString(" ")}",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
        }

        Mm3Panel(accent = tier.color) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "#$dailyTx / #$DAILY_TX_CAP",
                        color = tier.color,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Mm3Button(
                    text = if (showLog) "TX.LOG ▾" else "TX.LOG",
                    onClick = {
                        showLog = !showLog
                        if (showLog) loadTransactions(1)
                    },
                    accent = tier.color,
                    filled = showLog,
                    modifier = Modifier.weight(1f),
                )
                Column(Modifier.weight(1.4f)) {
                    Text(
                        "RATE",
                        color = tier.color.copy(alpha = 0.7f),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                    Text(
                        "${formatMoney(rateDisplay, currency)} / MM3",
                        color = tier.color,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                    )
                }
            }
        }

        if (showLog) {
            TxLogPanel(
                accent = tier.color,
                currency = currency,
                loading = txLoading,
                transactions = transactions,
                page = txPage,
                totalPages = totalPages,
                onRefresh = { loadTransactions(txPage) },
                onPrev = { if (txPage > 1) loadTransactions(txPage - 1) },
                onNext = { if (txPage < totalPages) loadTransactions(txPage + 1) },
                onClose = { showLog = false },
            )
        }

        Mm3Panel(accent = tier.color) {
            Text(
                "TRADE AMOUNT",
                color = tier.color.copy(alpha = 0.75f),
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
            Text(
                "${"%.8f".format(Locale.US, tradeAmount)} MM3",
                color = tier.color,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
            )
            Slider(
                value = ratio,
                onValueChange = { ratio = it },
                valueRange = 0f..1f,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(28.dp),
                colors = SliderDefaults.colors(
                    thumbColor = tier.color,
                    activeTrackColor = tier.color,
                    inactiveTrackColor = Mm3Colors.PanelSoft,
                ),
            )
            val receive = when (currency.uppercase()) {
                "USD" -> quote.netUsd
                "CNY" -> quote.netCny
                else -> quote.netEur
            }
            Text(
                "FEE ${(quote.commissionRate * 100).formatPct()}% · YOU RECEIVE · ${formatMoney(receive, currency)}",
                color = Mm3Colors.Green,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
            )
            Mm3Button(
                text = if (busy) "EXEC…" else "EXEC",
                onClick = {
                    if (wallet == null) {
                        message = "Connect wallet"
                        return@Mm3Button
                    }
                    if (mode != "sell" || tradeAmount < MIN_TRADE_MM3) {
                        message = "Select sell amount"
                        return@Mm3Button
                    }
                    if (dailyTx >= DAILY_TX_CAP) {
                        message = "Daily TX limit"
                        return@Mm3Button
                    }
                    busy = true
                    val amount = tradeAmount
                    val q = SellQuotes.getSellQuote(level, amount, zeroCommission = zeroCommission)
                    scope.launch {
                        val result = withContext(Dispatchers.IO) {
                            runCatching {
                                val progress = JSONObject()
                                    .put("wallet", wallet)
                                    .put("level", level)
                                    .put("mm3_sold", soldMm3 + q.totalMm3)
                                    .put("cny_earned", cnyEarned + q.netCny)
                                    .put("eur_earned", eurEarned + q.netEur)
                                    .put("usd_earned", usdEarned + q.netUsd)
                                    .put("sell_rate_cny", SellQuotes.sellRateCny(level))
                                    .put("sell_quote_cny", 0)
                                    .put("sell_quote_eur", 0)
                                    .put("sell_quote_usd", 0)
                                    .put("updated_at", Instant.now().toString())
                                val execPayload = JSONObject()
                                    .put("wallet", wallet)
                                    .put("progress", progress)
                                val execText = api.tradeExec(jsonBody(execPayload)).readText()
                                val execJson = runCatching { JSONObject(execText) }.getOrNull()
                                if (execJson?.optBoolean("ok") == false) {
                                    error(execJson.optString("error", "trade exec failed"))
                                }

                                if (supabase.configured) {
                                    runCatching {
                                        supabase.upsert("player_progress", progress, "wallet")
                                    }
                                    supabase.insert(
                                        "mm3_sell_transactions",
                                        JSONObject()
                                            .put("wallet", wallet)
                                            .put("source", source)
                                            .put("level", level)
                                            .put("mm3_amount", q.totalMm3)
                                            .put("mm3_commission", q.commissionMm3)
                                            .put("rate_cny", q.rateCny)
                                            .put("gross_cny", q.grossCny)
                                            .put("gross_eur", q.grossEur)
                                            .put("gross_usd", q.grossUsd)
                                            .put("commission_rate", q.commissionRate)
                                            .put("commission_cny", q.commissionCny)
                                            .put("commission_eur", q.commissionEur)
                                            .put("commission_usd", q.commissionUsd)
                                            .put("net_cny", q.netCny)
                                            .put("net_eur", q.netEur)
                                            .put("net_usd", q.netUsd),
                                    )
                                    runCatching {
                                        supabase.insert(
                                            "mm3_mining_events",
                                            JSONObject()
                                                .put("wallet", wallet)
                                                .put("event_type", "mining_resell")
                                                .put("delta_mm3", -q.totalMm3)
                                                .put("emoji", "📉"),
                                        )
                                    }
                                }
                                "sold ${formatMm3(q.totalMm3)} → ${formatMoney(q.netEur, "EUR")}"
                            }
                        }
                        busy = false
                        result.onSuccess {
                            message = "EXEC ok · $it"
                            ratio = 0f
                            reload()
                        }.onFailure {
                            message = it.message ?: "EXEC failed"
                        }
                    }
                },
                accent = tier.color,
                enabled = !busy &&
                    wallet != null &&
                    mode == "sell" &&
                    tradeAmount >= MIN_TRADE_MM3 &&
                    dailyTx < DAILY_TX_CAP,
            )
            Text(message, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
    }
}

@Composable
private fun TxLogPanel(
    accent: Color,
    currency: String,
    loading: Boolean,
    transactions: List<TradeTx>,
    page: Int,
    totalPages: Int,
    onRefresh: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onClose: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(max = 420.dp)
            .border(1.dp, accent.copy(alpha = 0.45f), RoundedCornerShape(8.dp))
            .background(Color(0xB3000000), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    "TX.LOG",
                    color = accent.copy(alpha = 0.7f),
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    letterSpacing = 2.sp,
                )
                Text(
                    "Ledger · SELL / BUY",
                    color = Color(0xFF64748B),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "$page/$totalPages",
                    color = Color(0xFF64748B),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
                Box(Modifier.width(100.dp)) {
                    Mm3Button(
                        text = if (loading) "…" else "REFRESH",
                        onClick = onRefresh,
                        accent = accent,
                        filled = false,
                        enabled = !loading,
                    )
                }
            }
        }

        when {
            loading && transactions.isEmpty() -> {
                Text(
                    "Loading…",
                    color = Mm3Colors.CyanDim,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0x2622D3EE), RoundedCornerShape(8.dp))
                        .background(Color(0x99020A12), RoundedCornerShape(8.dp))
                        .padding(12.dp),
                )
            }
            transactions.isEmpty() -> {
                Text(
                    "No transactions yet",
                    color = Color(0xFF64748B),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0x2622D3EE), RoundedCornerShape(8.dp))
                        .background(Color(0x99020A12), RoundedCornerShape(8.dp))
                        .padding(12.dp),
                )
            }
            else -> {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    transactions.forEach { tx ->
                        TxCard(tx = tx, currency = currency)
                    }
                }
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Mm3Button(
                text = "PREV",
                onClick = onPrev,
                accent = accent,
                filled = false,
                enabled = page > 1 && !loading,
                modifier = Modifier.weight(1f),
            )
            Mm3Button(
                text = "NEXT",
                onClick = onNext,
                accent = accent,
                filled = false,
                enabled = page < totalPages && !loading,
                modifier = Modifier.weight(1f),
            )
            Mm3Button(
                text = "CLOSE",
                onClick = onClose,
                accent = Color(0xFF94A3B8),
                filled = false,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun TxCard(tx: TradeTx, currency: String) {
    val isBuy = tx.mm3Amount < 0
    val txColor = if (isBuy) Color(0xFF22D3EE) else Color(0xFF4ADE80)
    val tradedMm3 = abs(tx.mm3Amount)
    val commissionMm3 = abs(tx.mm3Commission)
    val netMm3 = if (isBuy) max(0.0, tradedMm3 - commissionMm3) else tradedMm3
    val money = txMoney(tx, currency)
    val mm3Label = if (isBuy) "RECEIVED" else "SOLD"
    val fiatLabel = if (isBuy) "PAID" else "RECEIVED"

    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, txColor.copy(alpha = 0.27f), RoundedCornerShape(8.dp))
            .background(Color(0x99020A12), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (isBuy) "BUY" else "SELL",
                    color = txColor,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 11.sp,
                    letterSpacing = 1.5.sp,
                    modifier = Modifier
                        .border(1.dp, txColor, RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
                Text(
                    formatTxTime(tx.createdAt),
                    color = Color(0xFF64748B),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
            }
            Text(
                "LV ${tx.level} · ${if (tx.source == "google") "G" else "W"}",
                color = Color(0xFF64748B),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                letterSpacing = 1.sp,
            )
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TxStat(mm3Label, "${formatMm3(if (isBuy) netMm3 else tradedMm3)} MM3", txColor, Modifier.weight(1f))
            TxStat(fiatLabel, formatMoney(if (isBuy) money.gross else money.net, currency), Color(0xFFA5F3FC), Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f)) {
                TxStat("COMMISSION", formatMoney(money.commission, currency), Color(0xFFFCD34D), Modifier.fillMaxWidth())
                Text(
                    "${formatMm3(commissionMm3)} MM3 · ${(tx.commissionRate * 100).formatPct()}%",
                    color = Color(0x99FDE68A),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
            }
            TxStat("RATE", "${formatMoney(money.rate, currency)} / MM3", Color(0xFFCBD5E1), Modifier.weight(1f))
        }
    }
}

@Composable
private fun TxStat(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            label,
            color = Color(0xFF475569),
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
            letterSpacing = 1.2.sp,
        )
        Text(
            value,
            color = color,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 12.sp,
        )
    }
}

private data class TxMoney(val gross: Double, val net: Double, val commission: Double, val rate: Double)

private fun txMoney(tx: TradeTx, currency: String): TxMoney {
    val tradedMm3 = abs(tx.mm3Amount)
    val commissionMm3 = abs(tx.mm3Commission)
    val rate = txRate(tx, currency)
    val storedGross = abs(
        when (currency.uppercase()) {
            "USD" -> tx.grossUsd
            "CNY" -> tx.grossCny
            else -> tx.grossEur
        },
    )
    val storedNet = abs(
        when (currency.uppercase()) {
            "USD" -> tx.netUsd
            "CNY" -> tx.netCny
            else -> tx.netEur
        },
    )
    val storedCommission = abs(
        when (currency.uppercase()) {
            "USD" -> tx.commissionUsd
            "CNY" -> tx.commissionCny
            else -> tx.commissionEur
        },
    )
    val gross = if (storedGross > 0) storedGross else tradedMm3 * rate
    val commission = if (storedCommission > 0) storedCommission else commissionMm3 * rate
    val net = if (storedNet > 0) storedNet else max(0.0, gross - commission)
    return TxMoney(
        gross = gross,
        net = net,
        commission = commission,
        rate = if (rate > 0) rate else if (tradedMm3 > 0) gross / tradedMm3 else 0.0,
    )
}

private fun txRate(tx: TradeTx, currency: String): Double {
    if (tx.rateCny > 0) {
        return when (currency.uppercase()) {
            "USD" -> tx.rateCny * CNY_TO_USD
            "CNY" -> tx.rateCny
            else -> tx.rateCny * CNY_TO_EUR
        }
    }
    return SellQuotes.rateByCurrency(tx.level, currency)
}

private fun formatTxTime(value: String): String {
    return runCatching {
        val instant = Instant.parse(value)
        DateTimeFormatter.ofPattern("MM/dd HH:mm:ss")
            .withZone(ZoneId.systemDefault())
            .format(instant)
    }.getOrElse { value.take(16).ifBlank { "—" } }
}

private fun Double.formatPct(): String = "%.2f".format(Locale.US, this)
