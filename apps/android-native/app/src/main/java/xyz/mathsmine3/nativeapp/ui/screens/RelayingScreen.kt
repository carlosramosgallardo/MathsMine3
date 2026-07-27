package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.auth.AuthKind
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.SupabaseRest
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.realtime.SupabaseRealtimeClient
import xyz.mathsmine3.nativeapp.ui.components.mm3PortalBackground
import xyz.mathsmine3.nativeapp.ui.header.formatWalletLabel
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

private const val ACTIVE_WINDOW_MS = 90_000L
private const val MAX_HISTORY = 200
private const val GRID_COLS = 28
private val FILTER_KEYS = listOf("welcome", "mining", "mainframe", "squeezing", "donations", "bots")

private data class RelayMsg(
    val id: String,
    val kind: String,
    val wallet: String,
    val text: String,
    val ts: Long,
    val tone: String,
)

private data class PresenceWallet(
    val wallet: String,
    val source: String,
)

@Composable
fun RelayingScreen(
    session: Session,
    api: Mm3Api,
    supabase: SupabaseRest,
    realtime: SupabaseRealtimeClient,
    language: String = "en",
) {
    val es = language.startsWith("es", ignoreCase = true)
    val wallet = session.wallet?.lowercase()?.takeIf { it.isNotBlank() }
    val messages = remember { mutableStateListOf<RelayMsg>() }
    val seenIds = remember { mutableSetOf<String>() }
    val filters = remember {
        mutableStateMapOf<String, Boolean>().apply {
            // Show the useful system rails by default on native.
            FILTER_KEYS.forEach { put(it, true) }
            put("bots", false)
        }
    }
    var online by remember { mutableStateOf<List<PresenceWallet>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    var status by remember {
        mutableStateOf(
            when {
                !realtime.isConfigured -> if (es) "realtime offline" else "realtime offline"
                wallet == null -> if (es) "read-only · conecta wallet" else "read-only · connect wallet"
                else -> if (es) "sync…" else "sync…"
            },
        )
    }
    var sending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val ircTopic = realtime.protocol.ircRelay
    val rtInbox = remember { Channel<RelayMsg>(capacity = Channel.UNLIMITED) }
    val appendRef = remember { AtomicReference<(RelayMsg) -> Unit>({}) }

    fun appendLocal(msg: RelayMsg) {
        if (!seenIds.add(msg.id)) return
        messages.add(msg)
        if (messages.size > MAX_HISTORY + 80) {
            val drop = messages.size - MAX_HISTORY
            repeat(drop) {
                seenIds.remove(messages.removeAt(0).id)
            }
        }
    }
    appendRef.set(::appendLocal)

    fun systemLine(text: String, tone: String = "command") {
        appendLocal(
            RelayMsg(
                id = "sys:${System.currentTimeMillis()}:${UUID.randomUUID().toString().take(6)}",
                kind = "system",
                wallet = "system",
                text = text,
                ts = System.currentTimeMillis(),
                tone = tone,
            ),
        )
    }

    fun broadcastPayload(payload: JSONObject) {
        realtime.broadcast(ircTopic, "message", payload)
    }

    DisposableEffect(Unit) {
        realtime.connect()
        realtime.joinRelaying()
        realtime.onBroadcast(ircTopic, "message") { payload ->
            parseRelayPayload(payload)?.let { rtInbox.trySend(it) }
        }
        onDispose { }
    }

    LaunchedEffect(Unit) {
        for (msg in rtInbox) {
            appendRef.get().invoke(msg)
        }
    }

    LaunchedEffect(supabase.configured) {
        if (!supabase.configured) {
            status = if (es) "supabase offline" else "supabase offline"
            return@LaunchedEffect
        }
        val loaded = withContext(Dispatchers.IO) {
            runCatching {
                fun load(filter: String, limit: Int): List<RelayMsg> {
                    val rows = supabase.select(
                        "mm3_relaying_messages",
                        filter = filter,
                        columns = "wallet,text,ts,kind,tone",
                        order = "ts.desc",
                        limit = limit,
                    )
                    return buildList {
                        for (i in 0 until rows.length()) {
                            parseDbRow(rows.getJSONObject(i))?.let { add(it) }
                        }
                    }
                }
                // Prefer chat + market/squeeze traces; join/leave flood the table.
                val primary = load("tone=not.in.(join,leave,ghost)", MAX_HISTORY)
                val squeeze = load("tone=eq.squeeze", 80)
                val market = load("tone=eq.market", 80)
                val merged = LinkedHashMap<String, RelayMsg>()
                (primary + squeeze + market)
                    .sortedWith(compareBy({ it.ts }, { it.id }))
                    .forEach { merged[it.id] = it }
                merged.values.toList().takeLast(MAX_HISTORY)
            }.getOrElse { emptyList() }
        }
        loaded.forEach { appendLocal(it) }
        status = if (realtime.isConfigured) {
            if (es) "live · ${messages.size} msgs" else "live · ${messages.size} msgs"
        } else {
            if (es) "historial · ${messages.size}" else "history · ${messages.size}"
        }
        if (listState.layoutInfo.totalItemsCount > 0) {
            listState.scrollToItem(messages.lastIndex.coerceAtLeast(0))
        }
    }

    LaunchedEffect(wallet, session.kind) {
        if (wallet == null) return@LaunchedEffect
        while (isActive) {
            withContext(Dispatchers.IO) {
                runCatching {
                    api.presencePing(
                        jsonBody {
                            put("source", if (session.kind == AuthKind.GOOGLE) "google" else "wallet")
                        },
                    )
                }
            }
            delay(45_000)
        }
    }

    LaunchedEffect(supabase.configured) {
        if (!supabase.configured) return@LaunchedEffect
        while (isActive) {
            val next = withContext(Dispatchers.IO) {
                runCatching { loadPresence(supabase) }.getOrElse { emptyList() }
            }
            online = next
            delay(30_000)
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    fun send() {
        val text = normalizeRelayMessage(draft)
        if (text.isEmpty() || sending) return
        if (wallet == null) {
            systemLine(if (es) "conecta wallet para escribir" else "connect wallet to write")
            return
        }
        draft = ""
        sending = true
        scope.launch {
            try {
                handleSend(
                    text = text,
                    wallet = wallet,
                    session = session,
                    api = api,
                    supabase = supabase,
                    es = es,
                    online = online,
                    appendLocal = ::appendLocal,
                    systemLine = ::systemLine,
                    broadcastPayload = ::broadcastPayload,
                )
            } finally {
                sending = false
            }
        }
    }

    val visible = messages.filter { passesFilter(it, filters) }

    Column(
        Modifier
            .fillMaxSize()
            .mm3PortalBackground()
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "▸ RELAYING",
            color = Mm3Colors.Cyan,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            letterSpacing = 1.sp,
        )
        Text(
            "#relay-mainframe · $status · ${wallet?.let { formatWalletLabel(it) } ?: "anon"}",
            color = Mm3Colors.Muted,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
        )

        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            FILTER_KEYS.forEach { key ->
                val on = filters[key] == true
                Box(
                    Modifier
                        .border(
                            1.dp,
                            if (on) Mm3Colors.Cyan.copy(alpha = 0.7f) else Mm3Colors.Muted.copy(alpha = 0.35f),
                            RoundedCornerShape(2.dp),
                        )
                        .background(
                            if (on) Mm3Colors.Cyan.copy(alpha = 0.15f) else Color.Transparent,
                            RoundedCornerShape(2.dp),
                        )
                        .clickable { filters[key] = !on }
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(
                        key.uppercase(),
                        color = if (on) Mm3Colors.Cyan else Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 9.sp,
                    )
                }
            }
        }

        Text(
            if (es) "online · ${online.size} wal" else "online · ${online.size} wal",
            color = Mm3Colors.Green,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
        )
        if (online.isNotEmpty()) {
            Text(
                online.take(24).joinToString(" · ") { formatWalletLabel(it.wallet) },
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                maxLines = 2,
            )
        }

        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.3f), RoundedCornerShape(2.dp))
                .background(Mm3Colors.BgDeep.copy(alpha = 0.95f), RoundedCornerShape(2.dp))
                .padding(8.dp),
        ) {
            if (visible.isEmpty()) {
                Text(
                    "> waiting for traffic_",
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    items(visible, key = { it.id }) { msg ->
                        RelayLine(msg = msg, selfWallet = wallet, es = es)
                    }
                }
            }
        }

        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 42.dp)
                    .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
                    .background(Mm3Colors.Panel, RoundedCornerShape(2.dp))
                    .padding(horizontal = 10.dp, vertical = 10.dp),
            ) {
                BasicTextField(
                    value = draft,
                    onValueChange = { if (it.length <= 280) draft = it },
                    singleLine = true,
                    textStyle = TextStyle(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = Mm3Colors.Text,
                    ),
                    cursorBrush = SolidColor(Mm3Colors.Cyan),
                    modifier = Modifier.fillMaxWidth(),
                    decorationBox = { inner ->
                        if (draft.isEmpty()) {
                            Text(
                                if (es) "/? · /mine block #029 · chat…" else "/? · /mine block #029 · chat…",
                                color = Mm3Colors.Muted.copy(alpha = 0.7f),
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                            )
                        }
                        inner()
                    },
                )
            }
            Box(
                Modifier
                    .width(72.dp)
                    .height(42.dp)
                    .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.55f), RoundedCornerShape(2.dp))
                    .background(Mm3Colors.Cyan.copy(alpha = 0.18f), RoundedCornerShape(2.dp))
                    .clickable(enabled = !sending) { send() },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (sending) "…" else "SEND",
                    color = Mm3Colors.Cyan,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                )
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun RelayLine(msg: RelayMsg, selfWallet: String?, es: Boolean) {
    val time = formatRelayTime(msg.ts, es)
    val author = if (msg.kind == "system" || msg.wallet == "system") {
        systemAuthor(msg.tone)
    } else {
        val label = "${formatWalletLabel(msg.wallet)}@MM3·:~$"
        if (selfWallet != null && msg.wallet.equals(selfWallet, ignoreCase = true)) {
            "$label (${if (es) "tú" else "you"})"
        } else label
    }
    val color = toneColor(msg.tone, msg.kind)
    Column(Modifier.fillMaxWidth()) {
        Text(
            "$time  $author",
            color = Mm3Colors.Muted,
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
        )
        Text(
            msg.text,
            color = color,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            lineHeight = 14.sp,
        )
    }
}

private suspend fun handleSend(
    text: String,
    wallet: String,
    session: Session,
    api: Mm3Api,
    supabase: SupabaseRest,
    es: Boolean,
    online: List<PresenceWallet>,
    appendLocal: (RelayMsg) -> Unit,
    systemLine: (String, String) -> Unit,
    broadcastPayload: (JSONObject) -> Unit,
) {
    if (text.startsWith("/")) {
        val after = text.removePrefix("/").trim()
        val cmdName = after.split(Regex("\\s+")).firstOrNull()?.lowercase().orEmpty()

        if (after == "?" || cmdName == "help") {
            showHelp(supabase, es, systemLine)
            return
        }

        if (cmdName == "exec") {
            processExec(after, wallet, session, api, online, es, systemLine, appendLocal, broadcastPayload)
            return
        }

        if (processBuy(text, wallet, api, es, systemLine, appendLocal, broadcastPayload)) return
        if (processResell(text, wallet, session, api, es, systemLine, appendLocal, broadcastPayload)) return
        if (processMine(text, wallet, api, es, systemLine, appendLocal, broadcastPayload)) return

        // Known public market commands — index only on native for now
        val marketHit = withContext(Dispatchers.IO) {
            runCatching {
                val rows = supabase.select(
                    "mm3_mining_blocks",
                    filter = "market_command=not.is.null",
                    columns = "market_command",
                    limit = 200,
                )
                val normalized = text.replace(Regex("\\s+"), " ").trim()
                (0 until rows.length()).any { i ->
                    rows.getJSONObject(i).optString("market_command")
                        .replace(Regex("\\s+"), " ").trim()
                        .equals(normalized, ignoreCase = false)
                }
            }.getOrDefault(false)
        }
        if (marketHit) {
            systemLine(
                if (es) {
                    "cmd mercado reconocido :: lanza la penalización desde web Mining / Relaying por ahora"
                } else {
                    "market cmd recognized :: launch penalty from web Mining / Relaying for now"
                },
                "command",
            )
            return
        }

        systemLine(
            if (es) "comando no encontrado :: /$cmdName :: usa /?" else "command not found :: /$cmdName :: type /?",
            "command",
        )
        return
    }

    // Regular chat
    val now = System.currentTimeMillis()
    val id = "msg:$wallet:$now:${UUID.randomUUID().toString().take(5)}"
    val msg = RelayMsg(id = id, kind = "chat", wallet = wallet, text = text, ts = now, tone = "neutral")
    appendLocal(msg)
    withContext(Dispatchers.IO) {
        runCatching {
            api.relayChat(
                jsonBody {
                    put("text", text)
                    put("ts", now)
                    put("kind", "chat")
                    put("tone", "neutral")
                },
            )
        }
    }
    broadcastPayload(
        JSONObject()
            .put("id", id)
            .put("wallet", wallet)
            .put("text", text)
            .put("ts", now)
            .put("kind", "chat")
            .put("tone", "neutral"),
    )
}

private suspend fun showHelp(
    supabase: SupabaseRest,
    es: Boolean,
    systemLine: (String, String) -> Unit,
) {
    val lines = withContext(Dispatchers.IO) {
        runCatching {
            val rows = supabase.select(
                "mm3_mining_blocks",
                filter = "market_command=not.is.null",
                columns = "block_key,emoji,grid_row,grid_col,market_command",
                limit = 200,
            )
            val entries = buildList {
                for (i in 0 until rows.length()) {
                    val r = rows.getJSONObject(i)
                    val cmd = r.optString("market_command").trim()
                    if (cmd.isBlank()) continue
                    val hex = blockHexFromRow(r)
                    val emoji = r.optString("emoji").ifBlank { "?" }
                    val effect = if (cmd.contains("mm3", ignoreCase = true)) "mm3" else "money"
                    // Prefer known mm3-* keys from MARKET_COMMANDS rail heuristic via payment in command text
                    add(Triple(emoji, hex, cmd) to effect)
                }
            }
            val header = if (es) {
                listOf(
                    "índice cmd :: ${entries.size} cmds cargados :: /?",
                    "mine block :: /mine block #029",
                    "buy :: /buy #029",
                    "resell :: /resell #029",
                    "exec :: /exec @0x…",
                )
            } else {
                listOf(
                    "cmd index :: ${entries.size} cmds loaded :: /?",
                    "mine block :: /mine block #029",
                    "buy :: /buy #029",
                    "resell :: /resell #029",
                    "exec :: /exec @0x…",
                )
            }
            header + entries.map { (trip, _) ->
                val (emoji, hex, cmd) = trip
                "$emoji  $hex   $cmd"
            }
        }.getOrElse { listOf(it.message ?: "help failed") }
    }
    lines.forEachIndexed { i, line ->
        systemLine(line, "command")
        if (i < lines.lastIndex) delay(2)
    }
}

private suspend fun processExec(
    after: String,
    wallet: String,
    session: Session,
    api: Mm3Api,
    online: List<PresenceWallet>,
    es: Boolean,
    systemLine: (String, String) -> Unit,
    appendLocal: (RelayMsg) -> Unit,
    broadcastPayload: (JSONObject) -> Unit,
) {
    val match = Regex("^exec\\s+@(\\S+)", RegexOption.IGNORE_CASE).find(after)
    if (match == null) {
        systemLine(if (es) "uso: /exec @wallet" else "usage: /exec @wallet", "command")
        return
    }
    if (!session.hasApiSession) {
        systemLine(
            if (es) {
                "exec requiere sesión API :: vuelve a entrar con Google (Bearer)"
            } else {
                "exec needs API session :: sign in again with Google (Bearer)"
            },
            "command",
        )
        return
    }
    val targetRaw = match.groupValues[1].lowercase()
    val target = online.find {
        it.wallet == targetRaw || formatWalletLabel(it.wallet).equals(targetRaw, ignoreCase = true)
    }?.wallet
    if (target == null) {
        systemLine(if (es) "target offline" else "target offline", "command")
        return
    }
    val result = withContext(Dispatchers.IO) {
        runCatching {
            val raw = api.relayExec(
                jsonBody {
                    put("wallet", wallet)
                    put("targetWallet", target)
                },
            ).readText()
            JSONObject(raw)
        }
    }
    result.onSuccess { data ->
        if (!data.optBoolean("ok")) {
            val err = data.optString("error")
            val mapped = when (err) {
                "exec_self" -> if (es) "no puedes exec a ti mismo" else "cannot exec yourself"
                "target_offline" -> if (es) "target offline" else "target offline"
                "cooldown_active" -> if (es) "cooldown 24h activo" else "24h cooldown active"
                "unauthorized" -> if (es) "no autorizado · sesión" else "unauthorized · session"
                else -> if (es) "exec falló :: $err" else "exec failed :: $err"
            }
            systemLine(mapped, "command")
        } else {
            val origin = data.optInt("originExecs")
            val targetExecs = data.optInt("targetExecs")
            val level = data.optInt("level")
            val delta = data.optDouble("relayDelta")
            val trace =
                "🔁 relay exec >> ${formatWalletLabel(wallet)} → ${formatWalletLabel(target)} >> " +
                    "execs: #${origin.toString(16).uppercase()} + #${targetExecs.toString(16).uppercase()} >> " +
                    "lv.$level >> Δmm3:${if (delta >= 0) "+" else ""}${"%.6f".format(Locale.US, delta)}"
            val now = System.currentTimeMillis()
            val msg = RelayMsg(
                id = "sys:exec:$now",
                kind = "system",
                wallet = "system",
                text = trace,
                ts = now,
                tone = "market",
            )
            appendLocal(msg)
            broadcastPayload(
                JSONObject()
                    .put("id", msg.id)
                    .put("kind", "system")
                    .put("wallet", "system")
                    .put("text", trace)
                    .put("ts", now)
                    .put("tone", "market"),
            )
        }
    }.onFailure {
        systemLine(if (es) "exec falló :: red" else "exec failed :: network", "command")
    }
}

private suspend fun processMine(
    text: String,
    wallet: String,
    api: Mm3Api,
    es: Boolean,
    systemLine: (String, String) -> Unit,
    appendLocal: (RelayMsg) -> Unit,
    broadcastPayload: (JSONObject) -> Unit,
): Boolean {
    val match = Regex("^/mine\\s+block\\s+(#?[0-9a-f]{1,3})$", RegexOption.IGNORE_CASE).find(text.trim())
        ?: return false
    val blockHex = normalizeBlockHex(match.groupValues[1])
    val data = withContext(Dispatchers.IO) {
        runCatching {
            JSONObject(
                api.mineBlock(
                    jsonBody {
                        put("wallet", wallet)
                        put("blockHex", blockHex)
                    },
                ).readText(),
            )
        }.getOrNull()
    }
    if (data == null) {
        systemLine(if (es) "mine falló :: red" else "mine failed :: network", "command")
        return true
    }
    if (data.optBoolean("ok")) {
        val trace = data.optString("trace").ifBlank {
            "MM3 BLOCK CHAIN IN PROGRESS >> mined $blockHex"
        }
        val now = data.optLong("ts").takeIf { it > 0 } ?: System.currentTimeMillis()
        val msg = RelayMsg(
            id = "db:system:$now",
            kind = "system",
            wallet = "system",
            text = trace,
            ts = now,
            tone = "market",
        )
        appendLocal(msg)
        broadcastPayload(
            JSONObject()
                .put("id", msg.id)
                .put("kind", "system")
                .put("wallet", "system")
                .put("text", trace)
                .put("ts", now)
                .put("tone", "market"),
        )
    } else {
        systemLine(
            if (es) "mine block rechazado :: $blockHex :: ${data.optString("error")}"
            else "mine block rejected :: $blockHex :: ${data.optString("error")}",
            "command",
        )
    }
    return true
}

private suspend fun processBuy(
    text: String,
    wallet: String,
    api: Mm3Api,
    es: Boolean,
    systemLine: (String, String) -> Unit,
    appendLocal: (RelayMsg) -> Unit,
    broadcastPayload: (JSONObject) -> Unit,
): Boolean {
    val match = Regex("^/buy\\s+(#?[0-9a-f]{1,3})$", RegexOption.IGNORE_CASE).find(text.trim())
        ?: return false
    val blockHex = normalizeBlockHex(match.groupValues[1])
    // Web /buy uses the same mine-block endpoint for NFTJI purchase path
    val data = withContext(Dispatchers.IO) {
        runCatching {
            JSONObject(
                api.mineBlock(
                    jsonBody {
                        put("wallet", wallet)
                        put("blockHex", blockHex)
                    },
                ).readText(),
            )
        }.getOrNull()
    }
    if (data == null) {
        systemLine(if (es) "buy falló :: red" else "buy failed :: network", "command")
        return true
    }
    if (data.optBoolean("ok")) {
        val trace = data.optString("trace").ifBlank { "buy ok :: $blockHex" }
        val now = data.optLong("ts").takeIf { it > 0 } ?: System.currentTimeMillis()
        val msg = RelayMsg(id = "db:buy:$now", kind = "system", wallet = "system", text = trace, ts = now, tone = "market")
        appendLocal(msg)
        broadcastPayload(
            JSONObject()
                .put("id", msg.id)
                .put("kind", "system")
                .put("wallet", "system")
                .put("text", trace)
                .put("ts", now)
                .put("tone", "market"),
        )
    } else {
        systemLine(
            if (es) "buy rechazado :: $blockHex :: ${data.optString("error")}"
            else "buy rejected :: $blockHex :: ${data.optString("error")}",
            "command",
        )
    }
    return true
}

private suspend fun processResell(
    text: String,
    wallet: String,
    session: Session,
    api: Mm3Api,
    es: Boolean,
    systemLine: (String, String) -> Unit,
    appendLocal: (RelayMsg) -> Unit,
    broadcastPayload: (JSONObject) -> Unit,
): Boolean {
    val match = Regex("^/resell\\s+(#?[0-9a-f]{1,3})$", RegexOption.IGNORE_CASE).find(text.trim())
        ?: return false
    if (!session.hasApiSession) {
        systemLine(
            if (es) "resell requiere sesión API :: Google de nuevo" else "resell needs API session :: Google again",
            "command",
        )
        return true
    }
    val blockHex = normalizeBlockHex(match.groupValues[1])
    val data = withContext(Dispatchers.IO) {
        runCatching {
            JSONObject(
                api.resellNftji(
                    jsonBody {
                        put("wallet", wallet)
                        put("blockHex", blockHex)
                    },
                ).readText(),
            )
        }.getOrNull()
    }
    if (data == null) {
        systemLine(if (es) "resell falló :: red" else "resell failed :: network", "command")
        return true
    }
    if (data.optBoolean("ok")) {
        val trace = data.optString("trace").ifBlank { "resell ok :: $blockHex" }
        val now = data.optLong("ts").takeIf { it > 0 } ?: System.currentTimeMillis()
        val msg = RelayMsg(id = "db:resell:$now", kind = "system", wallet = "system", text = trace, ts = now, tone = "market")
        appendLocal(msg)
        broadcastPayload(
            JSONObject()
                .put("id", msg.id)
                .put("kind", "system")
                .put("wallet", "system")
                .put("text", trace)
                .put("ts", now)
                .put("tone", "market"),
        )
    } else {
        systemLine(
            if (es) "resell rechazado :: $blockHex :: ${data.optString("error")}"
            else "resell rejected :: $blockHex :: ${data.optString("error")}",
            "command",
        )
    }
    return true
}

private fun loadPresence(supabase: SupabaseRest): List<PresenceWallet> {
    val since = java.time.Instant.ofEpochMilli(System.currentTimeMillis() - ACTIVE_WINDOW_MS).toString()
    val encoded = URLEncoder.encode(since, StandardCharsets.UTF_8.name())
    val rows = supabase.select(
        "mm3_wallet_presence",
        filter = "last_seen=gte.$encoded",
        columns = "wallet,source,last_seen",
        order = "last_seen.desc",
        limit = 200,
    )
    val seen = LinkedHashSet<String>()
    val out = mutableListOf<PresenceWallet>()
    for (i in 0 until rows.length()) {
        val r = rows.getJSONObject(i)
        val w = r.optString("wallet").lowercase()
        if (w.isBlank() || !seen.add(w)) continue
        out += PresenceWallet(w, r.optString("source").ifBlank { "wallet" })
    }
    return out.sortedBy { it.wallet }
}

private fun parseDbRow(r: JSONObject): RelayMsg? {
    val text = r.optString("text").trim()
    if (text.isBlank()) return null
    val ts = when (val raw = r.opt("ts")) {
        is Number -> raw.toLong()
        else -> r.optString("ts").toLongOrNull() ?: return null
    }
    val wallet = r.optString("wallet").ifBlank { "system" }
    val kind = r.optString("kind").ifBlank { if (wallet == "system") "system" else "chat" }
    val tone = r.optString("tone").ifBlank { "neutral" }
    return RelayMsg(
        id = "db:$wallet:$ts:${text.hashCode()}",
        kind = kind,
        wallet = wallet.lowercase(),
        text = text,
        ts = ts,
        tone = tone,
    )
}

private fun parseRelayPayload(payload: JSONObject): RelayMsg? {
    val text = payload.optString("text").trim()
    if (text.isBlank()) return null
    val ts = when (val raw = payload.opt("ts")) {
        is Number -> raw.toLong()
        else -> payload.optString("ts").toLongOrNull() ?: System.currentTimeMillis()
    }
    val wallet = payload.optString("wallet").ifBlank { "system" }
    val kind = payload.optString("kind").ifBlank {
        if (wallet.equals("system", true)) "system" else "chat"
    }
    val tone = payload.optString("tone").ifBlank { "neutral" }
    val id = payload.optString("id").ifBlank { "rt:$wallet:$ts:${text.hashCode()}" }
    return RelayMsg(id = id, kind = kind, wallet = wallet.lowercase(), text = text, ts = ts, tone = tone)
}

private fun passesFilter(msg: RelayMsg, filters: Map<String, Boolean>): Boolean {
    val type = messageFilterType(msg) ?: return true
    // Match web: show unless the chip is explicitly off.
    return filters[type] != false
}

private fun messageFilterType(message: RelayMsg): String? {
    if (message.tone == "bot") return "bots"
    if (message.kind != "system") return null
    return when (message.tone) {
        "accent" -> "welcome"
        "market" -> "mining"
        "squeeze" -> "squeezing"
        "realchain" -> "donations"
        "ghost", "join", "leave" -> "mainframe"
        else -> null
    }
}

private fun systemAuthor(tone: String): String = when (tone) {
    "kernelpanic" -> "root@mm3"
    "realchain" -> "MathsMine3@ETH·:~$"
    "market" -> "mining@MM3·:~$"
    "squeeze" -> "squeezing@MM3·:~$"
    "ghost", "join", "leave" -> "mainframe@MM3·:~$"
    "command" -> "cmd@MM3·:~$"
    "accent" -> "welcome@MM3·:~$"
    else -> "system@MM3·:~$"
}

private fun toneColor(tone: String, kind: String): Color = when {
    tone == "command" -> Mm3Colors.Danger
    tone == "market" -> Mm3Colors.Orange
    tone == "squeeze" -> Mm3Colors.Magenta
    tone == "kernelpanic" -> Mm3Colors.Yellow
    tone == "accent" -> Mm3Colors.Cyan
    kind == "system" -> Mm3Colors.CyanDim
    else -> Mm3Colors.Text
}

private fun normalizeRelayMessage(value: String): String =
    value.replace(Regex("\\s+"), " ").trim().take(280)

private fun normalizeBlockHex(value: String): String {
    val raw = value.trim().uppercase().removePrefix("#")
    if (!raw.matches(Regex("[0-9A-F]{1,3}"))) return ""
    return "#" + raw.padStart(3, '0')
}

private fun blockHexFromRow(r: JSONObject): String {
    if (r.has("grid_row") && !r.isNull("grid_row") && r.has("grid_col") && !r.isNull("grid_col")) {
        val index = r.optInt("grid_row") * GRID_COLS + r.optInt("grid_col")
        return "#" + index.toString(16).uppercase(Locale.US).padStart(3, '0')
    }
    val key = r.optString("block_key")
    val m = Regex("mm3-([0-9a-fA-F]{1,3})").find(key)
    return if (m != null) "#" + m.groupValues[1].uppercase(Locale.US).padStart(3, '0') else key
}

private fun formatRelayTime(ts: Long, es: Boolean): String {
    return try {
        val pattern = if (es) "dd/MM/yy HH:mm:ss" else "MM/dd/yy HH:mm:ss"
        SimpleDateFormat(pattern, Locale.US).format(Date(ts))
    } catch (_: Exception) {
        "--:--:--"
    }
}
