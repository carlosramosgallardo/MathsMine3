package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
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
import xyz.mathsmine3.nativeapp.auth.SessionTokenHolder
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.apiMessage
import xyz.mathsmine3.nativeapp.data.formatApiErrorBody
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.header.colorFromAddress
import xyz.mathsmine3.nativeapp.ui.header.colorFromPool
import xyz.mathsmine3.nativeapp.ui.header.formatMoney
import xyz.mathsmine3.nativeapp.ui.header.formatWalletLabel
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max

private const val HISTORY_PAGE = 10
private const val SQUEEZE_LIMIT = 5

private data class PoolCard(
    val code: String,
    val members: Int,
    val totalLevel: Int,
    val chainPct: Double,
    val squeezeCount: Int,
    val squeezeLimitReached: Boolean,
    val resetAt: String?,
    val wallets: List<String>,
    val walletsShort: List<String>,
)

private data class DisputeWallet(
    val wallet: String,
    val side: String,
    val level: Int,
    val nftji: Int,
    val hasPenalty: Boolean,
    val miningEmoji: String?,
    val miningLevel: Int,
    val squeezeEquipped: String?,
    val squeezeLevel: Int,
    val squeezeClaimed: Boolean,
    val deltaEur: Double,
)

private data class DisputeCard(
    val id: Long,
    val challenger: String,
    val defender: String,
    val status: String,
    val winner: String?,
    val registeredAt: String?,
    val battleStartAt: String?,
    val resolvedAt: String?,
    val cancelledAt: String?,
    val warPercent: Double,
    val naturePercent: Double,
    val diceModifier: Double,
    val chScore: Double,
    val dfScore: Double,
    val chWalletCount: Int,
    val dfWalletCount: Int,
    val transferEur: Double,
    val dropType: String?,
    val wallets: List<DisputeWallet>,
    val votes: List<String>,
)

private data class StatusMeta(val label: String, val color: Color)

private fun statusMeta(status: String): StatusMeta = when (status) {
    "proposing" -> StatusMeta("PROPOSAL", Color(0xFF64748B))
    "registering" -> StatusMeta("REGISTERING", Color(0xFF22D3EE))
    "battle_start" -> StatusMeta("BATTLE START", Color(0xFF22D3EE))
    "resolved" -> StatusMeta("RESOLVED", Color(0xFF4ADE80))
    "cancelled" -> StatusMeta("CANCELLED", Color(0xFF334155))
    else -> StatusMeta(status.uppercase(), Color(0xFF64748B))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SqueezingScreen(
    session: Session,
    api: Mm3Api,
    language: String = "en",
    currency: String = "EUR",
    onNativeRoute: (String) -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    val wallet = session.wallet?.lowercase()
    val es = language == "es"

    var myPool by remember { mutableStateOf<String?>(null) }
    var pools by remember { mutableStateOf(listOf<PoolCard>()) }
    var disputes by remember { mutableStateOf(listOf<DisputeCard>()) }
    var message by remember { mutableStateOf(if (es) "Cargando…" else "Loading…") }
    var busyPool by remember { mutableStateOf<String?>(null) }
    var claimBusy by remember { mutableStateOf<Long?>(null) }
    var expandedHistory by remember { mutableStateOf(setOf<Long>()) }
    var historyPage by remember { mutableIntStateOf(1) }
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }

    fun parseDispute(d: JSONObject): DisputeCard {
        val walletsArr = d.optJSONArray("wallets") ?: JSONArray()
        val wallets = buildList {
            for (i in 0 until walletsArr.length()) {
                val w = walletsArr.getJSONObject(i)
                add(
                    DisputeWallet(
                        wallet = w.optString("wallet").lowercase(),
                        side = w.optString("side"),
                        level = w.optInt("level_snap"),
                        nftji = w.optInt("nftji_snap"),
                        hasPenalty = w.optBoolean("has_penalty"),
                        miningEmoji = w.optString("mining_nftji_emoji").takeIf { it.isNotBlank() },
                        miningLevel = w.optInt("mining_nftji_level_snap"),
                        squeezeEquipped = w.optString("squeeze_nftji_equipped").takeIf { it.isNotBlank() },
                        squeezeLevel = w.optInt("squeeze_nftji_level"),
                        squeezeClaimed = w.optBoolean("squeeze_nftji_claimed"),
                        deltaEur = w.optDouble("delta_eur"),
                    ),
                )
            }
        }
        val votesArr = d.optJSONArray("votes") ?: JSONArray()
        val votes = buildList {
            for (i in 0 until votesArr.length()) add(votesArr.optString(i).lowercase())
        }
        val summary = d.opt("result_summary")
        val transfer = when (summary) {
            is JSONObject -> summary.optDouble("transfer_eur", 0.0)
            else -> 0.0
        }
        return DisputeCard(
            id = d.optLong("id"),
            challenger = d.optString("challenger_pool_code").uppercase(Locale.US),
            defender = d.optString("defender_pool_code").uppercase(Locale.US),
            status = d.optString("status"),
            winner = d.optString("winner").takeIf { it.isNotBlank() },
            registeredAt = d.optString("registered_at").takeIf { it.isNotBlank() },
            battleStartAt = d.optString("battle_start_at").takeIf { it.isNotBlank() },
            resolvedAt = d.optString("resolved_at").takeIf { it.isNotBlank() },
            cancelledAt = d.optString("cancelled_at").takeIf { it.isNotBlank() },
            warPercent = d.optDouble("war_percent"),
            naturePercent = d.optDouble("nature_percent"),
            diceModifier = d.optDouble("dice_modifier"),
            chScore = d.optDouble("ch_score"),
            dfScore = d.optDouble("df_score"),
            chWalletCount = d.optInt("ch_wallet_count"),
            dfWalletCount = d.optInt("df_wallet_count"),
            transferEur = transfer,
            dropType = d.optString("drop_type").takeIf { it.isNotBlank() },
            wallets = wallets,
            votes = votes,
        )
    }

    fun reload() {
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val nextMyPool = if (wallet != null) {
                        val poolJson = JSONObject(api.myPool(wallet).readText())
                        poolJson.optString("pool_code").takeIf { it.isNotBlank() }?.uppercase()
                    } else null
                    val poolsJson = JSONObject(api.poolsQuick().readText())
                    val arr = poolsJson.optJSONArray("pools") ?: JSONArray()
                    val nextPools = buildList {
                        for (i in 0 until arr.length()) {
                            val p = arr.getJSONObject(i)
                            val shorts = p.optJSONArray("member_wallets_short") ?: JSONArray()
                            val full = p.optJSONArray("member_wallets") ?: JSONArray()
                            add(
                                PoolCard(
                                    code = p.optString("pool_code").uppercase(Locale.US),
                                    members = p.optInt("member_count"),
                                    totalLevel = p.optInt("total_level"),
                                    chainPct = p.optDouble("block_chain_percent"),
                                    squeezeCount = p.optInt("squeeze_count"),
                                    squeezeLimitReached = p.optBoolean("squeeze_limit_reached"),
                                    resetAt = p.optString("reset_at").takeIf { it.isNotBlank() },
                                    wallets = buildList {
                                        for (j in 0 until full.length()) add(full.optString(j))
                                    },
                                    walletsShort = buildList {
                                        for (j in 0 until shorts.length()) add(shorts.optString(j))
                                    },
                                ),
                            )
                        }
                    }
                    val dJson = JSONObject(api.disputes(200).readText())
                    val dArr = dJson.optJSONArray("disputes") ?: JSONArray()
                    val nextDisputes = buildList {
                        for (i in 0 until dArr.length()) add(parseDispute(dArr.getJSONObject(i)))
                    }
                    Triple(nextMyPool, nextPools, nextDisputes)
                }
            }
            result.onSuccess { (nextMyPool, nextPools, nextDisputes) ->
                myPool = nextMyPool
                pools = nextPools
                disputes = nextDisputes
                message = if (es) {
                    "Listo · ${nextPools.size} pools · ${nextDisputes.size} squeezes"
                } else {
                    "Ready · ${nextPools.size} pools · ${nextDisputes.size} squeezes"
                }
            }.onFailure {
                message = it.message ?: "load failed"
            }
        }
    }

    LaunchedEffect(wallet) { reload() }

    LaunchedEffect(Unit) {
        while (isActive) {
            nowMs = System.currentTimeMillis()
            delay(1000)
        }
    }

    // Poll + auto-transition like the web panel.
    LaunchedEffect(disputes, wallet) {
        while (isActive) {
            val live = disputes.any { it.status !in setOf("resolved", "cancelled") }
            val proposing = disputes.any { it.status == "proposing" }
            val wait = when {
                live && proposing -> 3_000L
                live -> 10_000L
                else -> 30_000L
            }
            delay(wait)
            // fire transition posts then reload
            withContext(Dispatchers.IO) {
                disputes.forEach { d ->
                    runCatching {
                        when (d.status) {
                            "proposing" -> {
                                val deadline = parseMs(d.registeredAt)?.plus(5 * 60_000) ?: return@runCatching
                                if (System.currentTimeMillis() >= deadline) {
                                    api.cancelDispute(jsonBody { put("disputeId", d.id) }).readText()
                                }
                            }
                            "registering" -> {
                                val deadline = parseMs(d.registeredAt)?.plus(5 * 60_000) ?: return@runCatching
                                if (System.currentTimeMillis() >= deadline) {
                                    api.startBattle(jsonBody { put("disputeId", d.id) }).readText()
                                }
                            }
                            "battle_start" -> {
                                val deadline = parseMs(d.battleStartAt)?.plus(5_000) ?: return@runCatching
                                if (System.currentTimeMillis() >= deadline) {
                                    api.resolveDispute(jsonBody { put("disputeId", d.id) }).readText()
                                }
                            }
                        }
                    }
                }
            }
            reload()
        }
    }

    val myPoolData = pools.firstOrNull { it.code == myPool }
    val myLimit = myPoolData?.squeezeLimitReached == true
    val active = disputes.filter { it.status !in setOf("resolved", "cancelled") }
        .sortedByDescending { parseMs(it.registeredAt) ?: 0L }
    val history = disputes.filter { it.status in setOf("resolved", "cancelled") }
        .sortedByDescending { parseMs(it.resolvedAt) ?: parseMs(it.cancelledAt) ?: parseMs(it.registeredAt) ?: 0L }
    val histPages = max(1, (history.size + HISTORY_PAGE - 1) / HISTORY_PAGE)
    val histSlice = history.drop((historyPage - 1) * HISTORY_PAGE).take(HISTORY_PAGE)

    Mm3Screen(
        title = "SQUEEZING",
        subtitle = "my pool · ${myPool ?: "none"}",
    ) {
        // ── Active pools ──
        Mm3Panel(accent = Color(0xFFF87171)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${if (es) "Pools activos" else "Active pools"} · ${pools.size}",
                    color = Color(0xFF64748B),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    letterSpacing = 1.sp,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (myLimit && myPoolData?.resetAt != null) {
                        Text(
                            "LIMIT ${formatCountdown(parseMs(myPoolData.resetAt) ?: 0L, nowMs)}",
                            color = Color(0xFFEF4444),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                        )
                    }
                    Text(
                        "↻",
                        color = Color(0xFFF87171),
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.clickable { reload() },
                    )
                }
            }

            if (pools.isEmpty()) {
                Text(
                    if (es) "Sin pools" else "No pools",
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
            }

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                pools.forEach { pool ->
                    PoolCardView(
                        pool = pool,
                        isMine = pool.code == myPool,
                        canSqueeze = wallet != null && myPool != null && pool.code != myPool,
                        busy = busyPool == pool.code,
                        limitReached = myLimit,
                        squeezeLabel = if (es) "SQUEEZE" else "SQUEEZE",
                        myPoolLabel = if (es) "mi pool" else "my pool",
                        onSqueeze = {
                            if (wallet == null || myPool == null || myLimit) return@PoolCardView
                            busyPool = pool.code
                            scope.launch {
                                val res = withContext(Dispatchers.IO) {
                                    runCatching {
                                        if (SessionTokenHolder.get().isNullOrBlank()) {
                                            error(if (es) "Sin sesión — reconecta" else "No session — reconnect")
                                        }
                                        val raw = api.disputeVote(
                                            jsonBody {
                                                put("wallet", wallet)
                                                put("challengerPool", myPool)
                                                put("defenderPool", pool.code)
                                            },
                                        ).readText()
                                        val json = JSONObject(raw)
                                        if (json.optBoolean("ok") != true) {
                                            error(formatApiErrorBody(raw) ?: json.optString("error", "squeeze failed"))
                                        }
                                        val proposing = json.optBoolean("proposing") && !json.optBoolean("created")
                                        proposing to raw
                                    }
                                }
                                busyPool = null
                                res.onSuccess { (proposing, _) ->
                                    message = when {
                                        proposing && es -> "Propuesta enviada — otra wallet debe aceptar"
                                        proposing -> "Proposal sent — another wallet must accept"
                                        es -> "Squeeze iniciado"
                                        else -> "Squeeze started"
                                    }
                                    reload()
                                }.onFailure {
                                    message = it.apiMessage(it.message ?: "squeeze failed")
                                }
                            }
                        },
                    )
                }
            }
        }

        // ── Disputes ──
        Mm3Panel(accent = Color(0xFFF87171)) {
            Text(
                if (es) "SQUEEZES" else "SQUEEZES",
                color = Color(0xFFF87171),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                letterSpacing = 2.sp,
            )
            Text(message, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)

            if (active.isEmpty() && history.isEmpty()) {
                Text(
                    if (es) "Aún no hay batallas Squeeze." else "No Squeeze battles yet.",
                    color = Color(0xFF64748B),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0x22334D5F))
                        .background(Color(0xB3020617))
                        .padding(12.dp),
                )
            }

            if (active.isNotEmpty()) {
                Text(
                    "${active.size} ${if (es) "activas" else "active"}",
                    color = Color(0xFF94A3B8),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
                active.forEach { d ->
                    DisputeCardView(
                        dispute = d,
                        myWallet = wallet,
                        myPool = myPool,
                        currency = currency,
                        es = es,
                        nowMs = nowMs,
                        collapsed = false,
                        claimBusy = claimBusy == d.id,
                        onToggle = null,
                        onJoin = {
                            if (wallet == null) return@DisputeCardView
                            scope.launch {
                                val res = withContext(Dispatchers.IO) {
                                    runCatching {
                                        if (SessionTokenHolder.get().isNullOrBlank()) {
                                            error(if (es) "Sin sesión — reconecta" else "No session — reconnect")
                                        }
                                        api.joinDispute(
                                            jsonBody {
                                                put("wallet", wallet)
                                                put("disputeId", d.id)
                                            },
                                        ).readText()
                                    }
                                }
                                res.onSuccess {
                                    message = if (es) "Unido" else "Joined"
                                    reload()
                                }.onFailure { message = it.apiMessage(it.message ?: "join failed") }
                            }
                        },
                        onAcceptProposal = {
                            if (wallet == null || myPool == null) return@DisputeCardView
                            busyPool = d.defender
                            scope.launch {
                                val res = withContext(Dispatchers.IO) {
                                    runCatching {
                                        if (SessionTokenHolder.get().isNullOrBlank()) {
                                            error(if (es) "Sin sesión — reconecta" else "No session — reconnect")
                                        }
                                        val raw = api.disputeVote(
                                            jsonBody {
                                                put("wallet", wallet)
                                                put("challengerPool", myPool)
                                                put("defenderPool", d.defender)
                                            },
                                        ).readText()
                                        val json = JSONObject(raw)
                                        if (json.optBoolean("ok") != true) {
                                            error(formatApiErrorBody(raw) ?: json.optString("error", "vote failed"))
                                        }
                                        raw
                                    }
                                }
                                busyPool = null
                                res.onSuccess {
                                    message = if (es) "Squeeze aceptado" else "Squeeze accepted"
                                    reload()
                                }.onFailure { message = it.apiMessage(it.message ?: "accept failed") }
                            }
                        },
                        onClaim = {
                            if (wallet == null) return@DisputeCardView
                            claimBusy = d.id
                            scope.launch {
                                val res = withContext(Dispatchers.IO) {
                                    runCatching {
                                        api.claimDisputeNftjiDrop(
                                            jsonBody {
                                                put("wallet", wallet)
                                                put("disputeId", d.id)
                                            },
                                        ).readText()
                                    }
                                }
                                claimBusy = null
                                res.onSuccess {
                                    message = if (es) "Drop reclamado" else "Drop claimed"
                                    reload()
                                }.onFailure { message = it.message ?: "claim failed" }
                            }
                        },
                        onRanking = { onNativeRoute("ranking") },
                    )
                }
            }

            histSlice.forEach { d ->
                val open = d.id in expandedHistory
                DisputeCardView(
                    dispute = d,
                    myWallet = wallet,
                    myPool = myPool,
                    currency = currency,
                    es = es,
                    nowMs = nowMs,
                    collapsed = !open,
                    claimBusy = claimBusy == d.id,
                    onToggle = {
                        expandedHistory = if (open) expandedHistory - d.id else expandedHistory + d.id
                    },
                    onJoin = {},
                    onClaim = {
                        if (wallet == null) return@DisputeCardView
                        claimBusy = d.id
                        scope.launch {
                            val res = withContext(Dispatchers.IO) {
                                runCatching {
                                    api.claimDisputeNftjiDrop(
                                        jsonBody {
                                            put("wallet", wallet)
                                            put("disputeId", d.id)
                                        },
                                    ).readText()
                                }
                            }
                            claimBusy = null
                            res.onSuccess {
                                message = if (es) "Drop reclamado" else "Drop claimed"
                                reload()
                            }.onFailure { message = it.message ?: "claim failed" }
                        }
                    },
                    onRanking = { onNativeRoute("ranking") },
                )
            }

            if (history.isNotEmpty()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Mm3Button(
                        text = "<",
                        onClick = { historyPage = max(1, historyPage - 1) },
                        accent = Color(0xFFF87171),
                        filled = false,
                        enabled = historyPage > 1,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "$historyPage/$histPages",
                        color = Color(0xFF64748B),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        modifier = Modifier
                            .align(Alignment.CenterVertically)
                            .padding(horizontal = 8.dp),
                    )
                    Mm3Button(
                        text = ">",
                        onClick = { historyPage = minOf(histPages, historyPage + 1) },
                        accent = Color(0xFFF87171),
                        filled = false,
                        enabled = historyPage < histPages,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        if (wallet == null) {
            Mm3Panel {
                Text(
                    if (es) "Conecta wallet para squeeze" else "Connect wallet to squeeze",
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                )
                Mm3Button(text = "AUTH", onClick = { onNativeRoute("auth") }, accent = Mm3Colors.Cyan)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PoolCardView(
    pool: PoolCard,
    isMine: Boolean,
    canSqueeze: Boolean,
    busy: Boolean,
    limitReached: Boolean,
    squeezeLabel: String,
    myPoolLabel: String,
    onSqueeze: () -> Unit,
) {
    val poolColor = colorFromPool(pool.code)
    Column(
        Modifier
            .width(190.dp)
            .border(
                1.dp,
                if (isMine) poolColor.copy(alpha = 0.33f) else Color(0xFF1E293B),
                RoundedCornerShape(0),
            )
            .background(
                if (isMine) poolColor.copy(alpha = 0.05f) else Color(0xFF080808),
                RoundedCornerShape(0),
            )
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "#${pool.code}",
                color = poolColor,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 13.sp,
                letterSpacing = 0.5.sp,
            )
            if (isMine) {
                Spacer(Modifier.width(6.dp))
                Text(
                    myPoolLabel,
                    color = poolColor,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 8.sp,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier
                        .border(1.dp, poolColor.copy(alpha = 0.27f), RoundedCornerShape(0))
                        .padding(horizontal = 4.dp, vertical = 1.dp),
                )
            }
            Spacer(Modifier.weight(1f))
            Text(
                "${pool.members}w",
                color = Color(0xFF475569),
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "LVL ${pool.totalLevel}",
                color = Color(0xFF94A3B8),
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
            )
            Text(
                "CHAIN ${"%.1f".format(Locale.US, pool.chainPct)}%",
                color = Color(0xFF94A3B8),
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
            )
            if (pool.squeezeCount > 0) {
                Text(
                    "⚔ ${pool.squeezeCount}/$SQUEEZE_LIMIT",
                    color = Color(0xFFF87171),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp,
                )
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            pool.walletsShort.take(5).forEachIndexed { i, short ->
                val wColor = colorFromAddress(pool.wallets.getOrNull(i) ?: short)
                Text(
                    short,
                    color = wColor,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp,
                    modifier = Modifier
                        .background(Color(0xFF0F172A), RoundedCornerShape(0))
                        .border(1.dp, wColor.copy(alpha = 0.13f), RoundedCornerShape(0))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                )
            }
        }
        if (canSqueeze) {
            val disabled = busy || limitReached
            Box(
                Modifier
                    .fillMaxWidth()
                    .border(
                        1.dp,
                        if (disabled) Color(0x1AF87171) else Color(0x44F87171),
                        RoundedCornerShape(0),
                    )
                    .background(if (disabled) Color.Transparent else Color(0x107F1D1D), RoundedCornerShape(0))
                    .clickable(enabled = !disabled, onClick = onSqueeze)
                    .padding(vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (busy) "…" else "⚔ $squeezeLabel",
                    color = if (disabled) Color(0xFF4B5563) else Color(0xFFFCA5A5),
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 10.sp,
                    letterSpacing = 1.2.sp,
                )
            }
        }
    }
}

@Composable
private fun DisputeCardView(
    dispute: DisputeCard,
    myWallet: String?,
    myPool: String?,
    currency: String,
    es: Boolean,
    nowMs: Long,
    collapsed: Boolean,
    claimBusy: Boolean,
    onToggle: (() -> Unit)?,
    onJoin: () -> Unit,
    onAcceptProposal: () -> Unit = {},
    onClaim: () -> Unit,
    onRanking: () -> Unit,
) {
    val meta = statusMeta(dispute.status)
    val isProposing = dispute.status == "proposing"
    val isRegistering = dispute.status == "registering"
    val isBattle = dispute.status == "battle_start"
    val isResolved = dispute.status == "resolved"
    val isCancelled = dispute.status == "cancelled"
    val chColor = Color(0xFF22D3EE)
    val dfColor = Color(0xFFF59E0B)

    if (collapsed) {
        val icon = when {
            isCancelled -> "💨"
            dispute.winner == "draw" -> "⚖️"
            dispute.winner == "challenger" -> "🏆"
            else -> "🛡️"
        }
        Row(
            Modifier
                .fillMaxWidth()
                .border(1.dp, meta.color.copy(alpha = 0.2f), RoundedCornerShape(0))
                .background(Color(0x80020617), RoundedCornerShape(0))
                .clickable { onToggle?.invoke() }
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(icon, fontSize = 13.sp)
            Text(dispute.challenger, color = chColor, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            Text("vs", color = Color(0xFF475569), fontFamily = FontFamily.Monospace, fontSize = 10.sp)
            Text(dispute.defender, color = dfColor, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            if (!isCancelled) {
                Text(
                    "${"%.2f".format(Locale.US, dispute.chScore)} – ${"%.2f".format(Locale.US, dispute.dfScore)}",
                    color = Color(0xFF94A3B8),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
            }
            if (dispute.transferEur > 0) {
                Text(
                    "+${formatMoney(dispute.transferEur, currency)}",
                    color = Color(0xFF4ADE80),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
            }
            Spacer(Modifier.weight(1f))
            Text("▼", color = Color(0xFF475569), fontSize = 10.sp)
        }
        return
    }

    val proposalDeadline = parseMs(dispute.registeredAt)?.plus(5 * 60_000)
    val battleDeadline = parseMs(dispute.registeredAt)?.plus(5 * 60_000)
    val resolveDeadline = parseMs(dispute.battleStartAt)?.plus(5_000)
    val canJoin = isRegistering &&
        myPool == dispute.challenger &&
        myWallet != null &&
        dispute.wallets.none { it.wallet == myWallet }
    val canAcceptProposal = isProposing &&
        myPool == dispute.challenger &&
        myWallet != null &&
        !dispute.votes.contains(myWallet)

    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, meta.color.copy(alpha = 0.27f), RoundedCornerShape(0))
            .background(Color(0xB3020617), RoundedCornerShape(0))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                dispute.challenger,
                color = chColor,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                modifier = Modifier.clickable(onClick = onRanking),
            )
            Text("vs", color = Color(0xFF64748B), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
            Text(
                dispute.defender,
                color = dfColor,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                modifier = Modifier.clickable(onClick = onRanking),
            )
            Spacer(Modifier.weight(1f))
            Text(
                meta.label,
                color = meta.color,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                letterSpacing = 1.sp,
                modifier = Modifier
                    .border(1.dp, meta.color.copy(alpha = 0.4f), RoundedCornerShape(0))
                    .padding(horizontal = 7.dp, vertical = 2.dp),
            )
            if (onToggle != null) {
                Text(
                    "▲",
                    color = Color(0xFF334155),
                    fontSize = 10.sp,
                    modifier = Modifier.clickable { onToggle() },
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                when {
                    isProposing -> if (es) "PROPUESTA" else "PROPOSED"
                    isRegistering -> if (es) "REGISTRO" else "REGISTERED"
                    isBattle -> if (es) "BATALLA" else "BATTLE"
                    isResolved -> if (es) "RESULTADO" else "RESULT"
                    else -> if (es) "CANCELADO" else "CANCELLED"
                },
                color = meta.color,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                letterSpacing = 0.8.sp,
            )
            Text(
                formatUtc(dispute.registeredAt),
                color = Color(0xFF64748B),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
        }

        if (isProposing && proposalDeadline != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (es) "esperando a una wallet más del pool o se cancelará en"
                    else "waiting for another wallet from the pool or cancels in",
                    color = Color(0xFF64748B),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier.weight(1f),
                )
                CountdownText(proposalDeadline, nowMs, Color(0xFF64748B))
            }
            if (canAcceptProposal) {
                Mm3Button(
                    text = if (es) "✓ ACEPTAR" else "✓ ACCEPT",
                    onClick = onAcceptProposal,
                    accent = Color(0xFF4ADE80),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (isCancelled) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0x66475569), RoundedCornerShape(0))
                    .background(Color(0x990F172A), RoundedCornerShape(0))
                    .padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("💨", fontSize = 16.sp)
                Column {
                    Text(
                        if (es) "INTENTO DE SQUEEZE FALLIDO" else "FAILED SQUEEZE ATTEMPT",
                        color = Color(0xFF64748B),
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                    )
                    Text(
                        "${dispute.challenger} ${if (es) "intentó un squeeze a" else "attempted to squeeze"} ${dispute.defender}",
                        color = Color(0xFF475569),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
            }
        }

        if (isRegistering) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (es) "Cierra en" else "Closes in",
                        color = Color(0xFF64748B),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                    if (battleDeadline != null) CountdownText(battleDeadline, nowMs, Color(0xFF22D3EE))
                }
                if (canJoin) {
                    Mm3Button(
                        text = if (es) "+ UNIRSE" else "+ JOIN",
                        onClick = onJoin,
                        accent = Color(0xFF22D3EE),
                        modifier = Modifier.width(110.dp),
                    )
                }
            }
        }

        if (isBattle || isResolved) {
            if (isBattle && resolveDeadline != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (es) "Resolviendo en" else "Resolving in",
                        color = Color(0xFF64748B),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                    CountdownText(resolveDeadline, nowMs, Color(0xFFF59E0B))
                }
            }
            Text(
                "🔥${"%.0f".format(Locale.US, dispute.warPercent)}%  🌪️${"%.0f".format(Locale.US, dispute.naturePercent)}%  🎲${"%.2f".format(Locale.US, dispute.diceModifier)}",
                color = Color(0xFF94A3B8),
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    "${"%.4f".format(Locale.US, dispute.chScore)}  ${dispute.challenger} (${dispute.chWalletCount}w)",
                    color = chColor,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                )
                Text(
                    "${dispute.defender} (${dispute.dfWalletCount}w)  ${"%.4f".format(Locale.US, dispute.dfScore)}",
                    color = dfColor,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                )
            }
            ScoreBar(chScore = dispute.chScore, dfScore = dispute.dfScore)
        }

        if (isResolved) {
            val winnerColor = when (dispute.winner) {
                "draw" -> Color(0xFF94A3B8)
                "challenger" -> chColor
                else -> dfColor
            }
            val winnerEmoji = when (dispute.winner) {
                "draw" -> "⚖️"
                "challenger" -> "🏆"
                else -> "🛡️"
            }
            val winnerLabel = when (dispute.winner) {
                "draw" -> "DRAW"
                "challenger" -> "CHALLENGER"
                else -> "DEFENDER"
            }
            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, winnerColor.copy(alpha = 0.4f), RoundedCornerShape(0))
                    .background(winnerColor.copy(alpha = 0.08f), RoundedCornerShape(0))
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    "$winnerEmoji  WINNER: $winnerLabel",
                    color = winnerColor,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                )
                if (dispute.transferEur > 0) {
                    Text(
                        "${if (es) "Transferido" else "Transferred"}: +${formatMoney(dispute.transferEur, currency)}",
                        color = Color(0xFF4ADE80),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                }
            }
        }

        if (isRegistering || isBattle || isResolved) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                WalletColumn(
                    pool = dispute.challenger,
                    color = chColor,
                    wallets = dispute.wallets.filter { it.side == "challenger" },
                    myWallet = myWallet,
                    currency = currency,
                    dropType = dispute.dropType,
                    isResolved = isResolved,
                    isWinnerSide = dispute.winner == "challenger",
                    claimBusy = claimBusy,
                    onClaim = onClaim,
                    onRanking = onRanking,
                    modifier = Modifier.weight(1f),
                )
                WalletColumn(
                    pool = dispute.defender,
                    color = dfColor,
                    wallets = dispute.wallets.filter { it.side == "defender" },
                    myWallet = myWallet,
                    currency = currency,
                    dropType = dispute.dropType,
                    isResolved = isResolved,
                    isWinnerSide = dispute.winner == "defender",
                    claimBusy = claimBusy,
                    onClaim = onClaim,
                    onRanking = onRanking,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun WalletColumn(
    pool: String,
    color: Color,
    wallets: List<DisputeWallet>,
    myWallet: String?,
    currency: String,
    dropType: String?,
    isResolved: Boolean,
    isWinnerSide: Boolean,
    claimBusy: Boolean,
    onClaim: () -> Unit,
    onRanking: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            "$pool (${wallets.size}w)",
            color = color,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
        )
        if (wallets.isEmpty()) {
            Text("—", color = Color(0xFF334155), fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        }
        wallets.forEach { w ->
            val isMe = w.wallet == myWallet
            val wColor = colorFromAddress(w.wallet)
            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0x22334D5F), RoundedCornerShape(0))
                    .background(if (isMe) color.copy(alpha = 0.06f) else Color.Transparent, RoundedCornerShape(0))
                    .padding(6.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        formatWalletLabel(w.wallet),
                        color = wColor,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = if (isMe) FontWeight.Black else FontWeight.Bold,
                        fontSize = 10.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .weight(1f)
                            .clickable(onClick = onRanking),
                    )
                    Text("Lv${w.level}", color = Color(0xFF64748B), fontFamily = FontFamily.Monospace, fontSize = 9.sp)
                    if (w.nftji > 0) {
                        Text("✦${w.nftji}", color = Color(0xFF22D3EE), fontFamily = FontFamily.Monospace, fontSize = 9.sp)
                    }
                    if (w.hasPenalty) Text("⚠️", fontSize = 10.sp)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (w.miningEmoji != null) {
                        NftjiSlot(emoji = w.miningEmoji, level = w.miningLevel, border = Color(0xFFFACC15))
                    }
                    if (isResolved && isWinnerSide && dropType != null && isMe && !w.squeezeClaimed) {
                        val dropEmoji = if (dropType == "defense") "🛡️" else "⚔️"
                        val dropColor = if (dropType == "defense") Color(0xFF22D3EE) else Color(0xFFF59E0B)
                        Box(
                            Modifier
                                .size(24.dp)
                                .border(1.dp, dropColor, RoundedCornerShape(0))
                                .background(dropColor.copy(alpha = 0.12f), RoundedCornerShape(0))
                                .clickable(enabled = !claimBusy, onClick = onClaim),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(if (claimBusy) "…" else dropEmoji, fontSize = 12.sp)
                        }
                    }
                    if (!w.squeezeEquipped.isNullOrBlank()) {
                        val eqEmoji = if (w.squeezeEquipped == "defense") "🛡️" else "⚔️"
                        NftjiSlot(
                            emoji = eqEmoji,
                            level = w.squeezeLevel,
                            border = if (w.squeezeEquipped == "defense") Color(0xFF22D3EE) else Color(0xFFF59E0B),
                        )
                    }
                    if (isResolved && w.deltaEur != 0.0) {
                        Spacer(Modifier.weight(1f))
                        Text(
                            "${if (w.deltaEur > 0) "+" else ""}${formatMoney(w.deltaEur, currency)}",
                            color = if (w.deltaEur > 0) Color(0xFF4ADE80) else Color(0xFFF87171),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NftjiSlot(emoji: String, level: Int, border: Color) {
    Column(
        Modifier
            .size(width = 24.dp, height = 28.dp)
            .border(1.dp, border.copy(alpha = 0.7f), RoundedCornerShape(0))
            .background(Color(0xFF02060B), RoundedCornerShape(0)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(emoji, fontSize = 11.sp)
        if (level > 0) {
            Text(
                "$level",
                color = border,
                fontFamily = FontFamily.Monospace,
                fontSize = 7.sp,
            )
        }
    }
}

@Composable
private fun ScoreBar(chScore: Double, dfScore: Double) {
    val total = (chScore + dfScore).coerceAtLeast(0.0001)
    val chFrac = (chScore / total).toFloat().coerceIn(0f, 1f)
    Box(
        Modifier
            .fillMaxWidth()
            .height(8.dp)
            .background(Color(0x12FFFFFF), RoundedCornerShape(0)),
    ) {
        Box(
            Modifier
                .fillMaxWidth(fraction = chFrac)
                .height(8.dp)
                .background(Color(0xFF22D3EE), RoundedCornerShape(0)),
        )
    }
}

@Composable
private fun CountdownText(targetMs: Long, nowMs: Long, color: Color) {
    Text(
        formatCountdown(targetMs, nowMs),
        color = color,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Bold,
        fontSize = 12.sp,
    )
}

private fun parseMs(iso: String?): Long? =
    iso?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }

private fun formatUtc(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return runCatching {
        DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss")
            .withZone(ZoneId.systemDefault())
            .format(Instant.parse(iso))
    }.getOrElse { iso.take(16) }
}

private fun formatCountdown(targetMs: Long, nowMs: Long): String {
    val left = max(0, (targetMs - nowMs) / 1000)
    val m = left / 60
    val s = left % 60
    return "%02d:%02d".format(Locale.US, m, s)
}
