package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.header.formatMm3
import xyz.mathsmine3.nativeapp.ui.header.formatMoney
import xyz.mathsmine3.nativeapp.ui.header.formatWalletLabel
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import xyz.mathsmine3.nativeapp.ui.theme.RankTiers
import java.util.Locale
import kotlin.math.max

private const val PAGE_SIZE = 20
private val AccentGold = Color(0xFFFBBF24)

private enum class RankView { WALLETS, POOLS }
private enum class RankSort { CHAIN, LEVEL, MM3 }

private data class WalletRankRow(
    val rank: Int,
    val wallet: String,
    val level: Int,
    val chainPct: Double,
    val minedBlocks: Int,
    val availableMm3: Double,
    val eur: Double,
    val usd: Double,
    val cny: Double,
    val nftjis: List<String>,
    val totalCorrect: Int,
    val bestStreak: Int,
)

private data class PoolRankRow(
    val rank: Int,
    val code: String,
    val members: Int,
    val totalLevel: Int,
    val chainPct: Double,
    val squeezeCount: Int,
    val squeezeLimit: Boolean,
    val walletsShort: List<String>,
)

@Composable
fun RankingScreen(
    session: Session,
    api: Mm3Api,
    currency: String = "EUR",
    language: String = "en",
) {
    val es = language.startsWith("es", ignoreCase = true)
    val selfLabel = session.wallet?.let { formatWalletLabel(it) }
    var view by remember { mutableStateOf(RankView.WALLETS) }
    var sort by remember { mutableStateOf(RankSort.CHAIN) }
    var page by remember { mutableIntStateOf(1) }
    var total by remember { mutableIntStateOf(0) }
    var wallets by remember { mutableStateOf<List<WalletRankRow>>(emptyList()) }
    var pools by remember { mutableStateOf<List<PoolRankRow>>(emptyList()) }
    var status by remember { mutableStateOf(if (es) "cargando…" else "loading…") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun loadWallets(p: Int = page) {
        loading = true
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val raw = api.leaderboard(page = p, limit = PAGE_SIZE).readText()
                    parseWalletPage(raw)
                }
            }
            result.onSuccess { (items, tot, pg) ->
                wallets = sortWallets(items, sort)
                total = tot
                page = pg
                status = if (es) "wallets · $tot" else "wallets · $tot"
            }.onFailure {
                status = it.message ?: "error"
            }
            loading = false
        }
    }

    fun loadPools() {
        loading = true
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val raw = api.poolsQuick().readText()
                    parsePools(raw)
                }
            }
            result.onSuccess { list ->
                pools = sortPools(list, sort)
                status = if (es) "pools · ${list.size}" else "pools · ${list.size}"
            }.onFailure {
                status = it.message ?: "error"
            }
            loading = false
        }
    }

    fun reload() {
        when (view) {
            RankView.WALLETS -> loadWallets(page)
            RankView.POOLS -> loadPools()
        }
    }

    LaunchedEffect(view) {
        page = 1
        reload()
    }

    LaunchedEffect(sort) {
        when (view) {
            RankView.WALLETS -> wallets = sortWallets(wallets, sort)
            RankView.POOLS -> pools = sortPools(pools, sort)
        }
    }

    LaunchedEffect(Unit) {
        while (isActive) {
            delay(120_000)
            reload()
        }
    }

    val totalPages = max(1, (total + PAGE_SIZE - 1) / PAGE_SIZE)

    Mm3Screen(
        title = "RANKING",
        subtitle = buildString {
            append(status)
            if (loading) append(" · sync…")
            selfLabel?.let { append(" · you $it") }
        },
    ) {
        // View toggle
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            ModeChip(
                label = if (es) "WALLETS" else "WALLETS",
                active = view == RankView.WALLETS,
                accent = AccentGold,
                onClick = { view = RankView.WALLETS },
                modifier = Modifier.weight(1f),
            )
            ModeChip(
                label = "POOLS",
                active = view == RankView.POOLS,
                accent = Mm3Colors.Magenta,
                onClick = { view = RankView.POOLS },
                modifier = Modifier.weight(1f),
            )
        }

        // Sort chips
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            SortChip("CHAIN %", sort == RankSort.CHAIN) { sort = RankSort.CHAIN }
            SortChip("LEVEL", sort == RankSort.LEVEL) { sort = RankSort.LEVEL }
            if (view == RankView.WALLETS) {
                SortChip("MM3", sort == RankSort.MM3) { sort = RankSort.MM3 }
            }
        }

        Mm3Button(
            text = if (loading) "…" else if (es) "Actualizar" else "Refresh",
            accent = AccentGold,
            enabled = !loading,
            onClick = { reload() },
        )

        when (view) {
            RankView.WALLETS -> {
                if (wallets.isEmpty() && !loading) {
                    Mm3Panel(accent = AccentGold) {
                        Text(
                            if (es) "sin datos" else "no data",
                            color = Mm3Colors.Muted,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                        )
                    }
                }
                wallets.forEach { row ->
                    val isSelf = selfLabel != null &&
                        (row.wallet.equals(selfLabel, ignoreCase = true) ||
                            row.wallet.contains(selfLabel.takeLast(3), ignoreCase = true))
                    WalletCard(row = row, currency = currency, highlight = isSelf)
                }
                if (total > PAGE_SIZE) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Mm3Button(
                            text = "PREV",
                            accent = AccentGold,
                            enabled = page > 1 && !loading,
                            modifier = Modifier.weight(1f),
                            onClick = { loadWallets(page - 1) },
                        )
                        Text(
                            "#$page / #$totalPages",
                            color = Mm3Colors.Muted,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                        )
                        Mm3Button(
                            text = "NEXT",
                            accent = AccentGold,
                            enabled = page < totalPages && !loading,
                            modifier = Modifier.weight(1f),
                            onClick = { loadWallets(page + 1) },
                        )
                    }
                }
            }
            RankView.POOLS -> {
                if (pools.isEmpty() && !loading) {
                    Mm3Panel(accent = Mm3Colors.Magenta) {
                        Text(
                            if (es) "sin pools" else "no pools",
                            color = Mm3Colors.Muted,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                        )
                    }
                }
                pools.forEach { row ->
                    PoolCard(row = row)
                }
            }
        }
    }
}

@Composable
private fun ModeChip(
    label: String,
    active: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .height(40.dp)
            .border(1.dp, if (active) accent.copy(alpha = 0.7f) else Mm3Colors.Muted.copy(alpha = 0.3f), RoundedCornerShape(2.dp))
            .background(if (active) accent.copy(alpha = 0.15f) else Color.Transparent, RoundedCornerShape(2.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (active) accent else Mm3Colors.Muted,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            letterSpacing = 1.sp,
        )
    }
}

@Composable
private fun SortChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .border(
                1.dp,
                if (active) Mm3Colors.Cyan.copy(alpha = 0.7f) else Mm3Colors.Muted.copy(alpha = 0.3f),
                RoundedCornerShape(2.dp),
            )
            .background(
                if (active) Mm3Colors.Cyan.copy(alpha = 0.12f) else Color.Transparent,
                RoundedCornerShape(2.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(
            label,
            color = if (active) Mm3Colors.Cyan else Mm3Colors.Muted,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
        )
    }
}

@Composable
private fun WalletCard(row: WalletRankRow, currency: String, highlight: Boolean) {
    val tier = RankTiers.forLevel(row.level)
    val fiat = when (currency.uppercase()) {
        "USD" -> row.usd
        "CNY" -> row.cny
        else -> row.eur
    }
    Mm3Panel(accent = if (highlight) Mm3Colors.Cyan else AccentGold) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "#${row.rank}",
                    color = AccentGold,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
                Column {
                    Text(
                        row.wallet + if (highlight) " · you" else "",
                        color = if (highlight) Mm3Colors.Cyan else Mm3Colors.Text,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                    )
                    Text(
                        "${tier.emoji} ${tier.label} · lv.${row.level}",
                        color = tier.color,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
            }
            Text(
                String.format(Locale.US, "%.2f%%", row.chainPct),
                color = Mm3Colors.Cyan,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
            )
        }
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                "${formatMm3(row.availableMm3)} MM3",
                color = Mm3Colors.Green,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
            Text(
                formatMoney(fiat, currency),
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
        }
        if (row.nftjis.isNotEmpty()) {
            Text(
                row.nftjis.joinToString(" "),
                fontSize = 14.sp,
            )
        }
        Text(
            "blocks ${row.minedBlocks} · correct ${row.totalCorrect} · streak ${row.bestStreak}",
            color = Mm3Colors.Muted.copy(alpha = 0.8f),
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
        )
    }
}

@Composable
private fun PoolCard(row: PoolRankRow) {
    Mm3Panel(accent = Mm3Colors.Magenta) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "#${row.rank}",
                    color = Mm3Colors.Magenta,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
                Column {
                    Text(
                        "#${row.code}",
                        color = Mm3Colors.Text,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                    Text(
                        "${row.members} wal · LVL ${row.totalLevel}",
                        color = Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
            }
            Text(
                String.format(Locale.US, "%.2f%%", row.chainPct),
                color = Mm3Colors.Cyan,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
            )
        }
        if (row.walletsShort.isNotEmpty()) {
            Text(
                row.walletsShort.joinToString(" · "),
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                maxLines = 2,
            )
        }
        Text(
            buildString {
                append("⚔ ${row.squeezeCount}/5")
                if (row.squeezeLimit) append(" · LIMIT")
            },
            color = if (row.squeezeLimit) Mm3Colors.Danger else Mm3Colors.Orange,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
        )
    }
}

private fun parseWalletPage(raw: String): Triple<List<WalletRankRow>, Int, Int> {
    val root = JSONObject(raw)
    if (root.has("error")) error(root.optString("error"))
    val arr = root.optJSONArray("items") ?: JSONArray()
    val items = buildList {
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val nftArr = o.optJSONArray("nftjis")
            val nftjis = buildList {
                if (nftArr != null) for (j in 0 until nftArr.length()) add(nftArr.optString(j))
            }
            add(
                WalletRankRow(
                    rank = o.optInt("rank"),
                    wallet = o.optString("wallet"),
                    level = o.optInt("level"),
                    chainPct = o.optDouble("block_chain_percent"),
                    minedBlocks = o.optInt("mined_block_count"),
                    availableMm3 = o.optDouble("available_mm3"),
                    eur = o.optDouble("eur_balance"),
                    usd = o.optDouble("usd_balance"),
                    cny = o.optDouble("cny_balance"),
                    nftjis = nftjis,
                    totalCorrect = o.optInt("total_correct"),
                    bestStreak = o.optInt("best_streak"),
                ),
            )
        }
    }
    return Triple(items, root.optInt("total"), root.optInt("page", 1))
}

private fun parsePools(raw: String): List<PoolRankRow> {
    val root = JSONObject(raw)
    val arr = root.optJSONArray("pools") ?: JSONArray()
    return buildList {
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val shorts = o.optJSONArray("member_wallets_short") ?: JSONArray()
            add(
                PoolRankRow(
                    rank = i + 1,
                    code = o.optString("pool_code").uppercase(Locale.US),
                    members = o.optInt("member_count"),
                    totalLevel = o.optInt("total_level"),
                    chainPct = o.optDouble("block_chain_percent"),
                    squeezeCount = o.optInt("squeeze_count"),
                    squeezeLimit = o.optBoolean("squeeze_limit_reached"),
                    walletsShort = buildList {
                        for (j in 0 until shorts.length()) add(shorts.optString(j))
                    },
                ),
            )
        }
    }
}

private fun sortWallets(list: List<WalletRankRow>, sort: RankSort): List<WalletRankRow> {
    val sorted = when (sort) {
        RankSort.CHAIN -> list.sortedWith(
            compareByDescending<WalletRankRow> { it.chainPct }
                .thenByDescending { it.level }
                .thenByDescending { it.availableMm3 },
        )
        RankSort.LEVEL -> list.sortedWith(
            compareByDescending<WalletRankRow> { it.level }
                .thenByDescending { it.chainPct }
                .thenByDescending { it.availableMm3 },
        )
        RankSort.MM3 -> list.sortedWith(
            compareByDescending<WalletRankRow> { it.availableMm3 }
                .thenByDescending { it.chainPct }
                .thenByDescending { it.level },
        )
    }
    // Keep API ranks when sorting matches default chain order on a page;
    // when re-sorting within page, keep displayed rank from API for identity.
    return sorted
}

private fun sortPools(list: List<PoolRankRow>, sort: RankSort): List<PoolRankRow> {
    val sorted = when (sort) {
        RankSort.CHAIN, RankSort.MM3 -> list.sortedWith(
            compareByDescending<PoolRankRow> { it.chainPct }.thenByDescending { it.totalLevel },
        )
        RankSort.LEVEL -> list.sortedWith(
            compareByDescending<PoolRankRow> { it.totalLevel }.thenByDescending { it.chainPct },
        )
    }
    return sorted.mapIndexed { i, row -> row.copy(rank = i + 1) }
}
