package xyz.mathsmine3.nativeapp.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.R
import xyz.mathsmine3.nativeapp.auth.AuthKind
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.SupabaseRest
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.header.AmbientMusic
import xyz.mathsmine3.nativeapp.ui.header.Dice
import xyz.mathsmine3.nativeapp.ui.header.colorFromAddress
import xyz.mathsmine3.nativeapp.ui.header.currencySymbol
import xyz.mathsmine3.nativeapp.ui.header.formatCompactNum
import xyz.mathsmine3.nativeapp.ui.header.formatWalletLabel
import xyz.mathsmine3.nativeapp.ui.header.localClockText
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import xyz.mathsmine3.nativeapp.ui.theme.RankTiers
import java.time.Instant
import java.time.ZoneOffset
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

private val DEFAULT_TICKER = mapOf(
    "en" to "welcome@MM3·:~\$ #MathsMine3 #TimedMath #FictionalMining #WalletIdentity #TerminalEconomy #RealTime3DMultiplayerWorld #Humor",
    "es" to "welcome@MM3·:~\$ #MathsMine3 #TimedMath #FictionalMining #WalletIdentity #TerminalEconomy #RealTime3DMultiplayerWorld #Humor",
)
private val STORMROLL = mapOf(
    "en" to "🎲 DICE ACTIVE // AoE DAMAGE ALERT // TAKE COVER: ENTER THE DICE POOL",
    "es" to "🎲 DICE ACTIVO // ALERTA DE DAÑO AoE // PROTÉGETE: ENTRA EN LA PISCINA DEL DADO",
)

private data class WalletSummary(
    val position: Int?,
    val level: Int,
    val availableMm3: Double,
    val fundsEur: Double,
    val fundsUsd: Double,
    val fundsCny: Double,
)

@Composable
fun PortalHeaderBar(
    session: Session,
    language: String,
    currency: String,
    soundEnabled: Boolean,
    musicEnabled: Boolean,
    api: Mm3Api,
    supabase: SupabaseRest,
    onNativeRoute: (String) -> Unit,
    onAuth: () -> Unit,
    onDisconnect: () -> Unit,
    onLanguage: (String) -> Unit,
    onCurrency: (String) -> Unit,
    onSound: (Boolean) -> Unit,
    onMusic: (Boolean) -> Unit,
) {
    val context = LocalContext.current
    val wallet = session.wallet?.lowercase()

    var clock by remember { mutableStateOf(localClockText()) }
    var tickerEn by remember { mutableStateOf(DEFAULT_TICKER.getValue("en")) }
    var tickerEs by remember { mutableStateOf(DEFAULT_TICKER.getValue("es")) }
    var stormroll by remember { mutableStateOf(false) }
    var stormrollExpiresAtMs by remember { mutableStateOf(0L) }
    var war by remember { mutableIntStateOf(50) }
    var nature by remember { mutableIntStateOf(50) }
    var activeWallets by remember { mutableIntStateOf(0) }
    var totalWallets by remember { mutableIntStateOf(0) }
    var diceNow by remember { mutableStateOf(Dice.state()) }
    var summary by remember { mutableStateOf<WalletSummary?>(null) }
    var pendingDaily by remember { mutableIntStateOf(0) }
    var currencyOpen by remember { mutableStateOf(false) }
    var languageOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (isActive) {
            clock = localClockText()
            diceNow = Dice.state()
            // Cut stormroll banner the instant node_dice_expires_at elapses and
            // restore the hardcoded welcome default (same as web MacroTicker).
            if (stormroll && stormrollExpiresAtMs > 0L && System.currentTimeMillis() >= stormrollExpiresAtMs) {
                stormroll = false
                stormrollExpiresAtMs = 0L
                tickerEn = DEFAULT_TICKER.getValue("en")
                tickerEs = DEFAULT_TICKER.getValue("es")
            }
            delay(1000)
        }
    }

    LaunchedEffect(musicEnabled) {
        AmbientMusic.setEnabled(context, musicEnabled)
    }
    DisposableEffect(Unit) {
        onDispose { AmbientMusic.stop() }
    }

    LaunchedEffect(Unit) {
        while (isActive) {
            withContext(Dispatchers.IO) {
                runCatching {
                    val status = JSONObject(api.portalStatus().readText())
                    war = status.optJSONObject("macro")?.optInt("war_percent", 50) ?: 50
                    nature = status.optJSONObject("macro")?.optInt("nature_percent", 50) ?: 50
                    activeWallets = status.optInt("activeWalletCount", 0)
                    totalWallets = status.optInt("totalWallets", 0)
                }
                if (supabase.configured) {
                    runCatching {
                        val macro = supabase.selectOne("mm3_macro_state", "id=eq.1")
                        if (macro != null) {
                            val expires = macro.optString("ticker_message_expires_at")
                            val expired = expires.isNotBlank() &&
                                runCatching { Instant.parse(expires).isBefore(Instant.now()) }.getOrDefault(false)
                            val legacy = if (expired) {
                                DEFAULT_TICKER.getValue("en")
                            } else {
                                macro.optString("ticker_message").ifBlank { DEFAULT_TICKER.getValue("en") }
                            }
                            tickerEn = if (expired) {
                                DEFAULT_TICKER.getValue("en")
                            } else {
                                macro.optString("ticker_message_en").ifBlank { legacy }
                            }
                            tickerEs = if (expired) {
                                DEFAULT_TICKER.getValue("es")
                            } else {
                                macro.optString("ticker_message_es").ifBlank { legacy }
                            }
                            val diceExp = macro.optString("node_dice_expires_at")
                            val diceExpiresMs = if (diceExp.isNotBlank()) {
                                runCatching { Instant.parse(diceExp).toEpochMilli() }.getOrDefault(0L)
                            } else {
                                0L
                            }
                            val diceActive = diceExpiresMs > System.currentTimeMillis()
                            if (diceActive) {
                                stormroll = true
                                stormrollExpiresAtMs = diceExpiresMs
                            } else if (stormroll) {
                                // Dice finished → restore welcome default immediately.
                                stormroll = false
                                stormrollExpiresAtMs = 0L
                                tickerEn = DEFAULT_TICKER.getValue("en")
                                tickerEs = DEFAULT_TICKER.getValue("es")
                            } else {
                                stormroll = false
                                stormrollExpiresAtMs = 0L
                            }
                        }
                    }
                }
            }
            delay(60_000)
        }
    }

    LaunchedEffect(wallet) {
        if (wallet == null) {
            summary = null
            pendingDaily = 0
            return@LaunchedEffect
        }
        while (isActive) {
            withContext(Dispatchers.IO) {
                runCatching {
                    val source = if (session.kind == AuthKind.GOOGLE) "google" else "wallet"
                    if (session.hasApiSession) {
                        runCatching {
                            api.presencePing(
                                jsonBody {
                                    put("source", source)
                                },
                            )
                        }
                    }
                    if (!supabase.configured) return@runCatching
                    val progress = supabase.selectOne(
                        "player_progress",
                        "wallet=eq.$wallet",
                        "level,mm3_sold,cny_earned,eur_earned,usd_earned",
                    )
                    val mined = supabase.selectOne("leaderboard_data", "wallet=eq.$wallet", "total_eth")
                        ?.optDouble("total_eth", 0.0) ?: 0.0
                    val sold = progress?.optDouble("mm3_sold", 0.0) ?: 0.0
                    val level = progress?.optInt("level", 0) ?: 0
                    val available = (mined - sold).coerceAtLeast(0.0)
                    // Position: approximate via leaderboard level sort when cheap enough
                    val position = runCatching {
                        val rows = supabase.select(
                            "leaderboard_data",
                            columns = "wallet,total_eth",
                            limit = 200,
                            order = "total_eth.desc",
                        )
                        var idx: Int? = null
                        for (i in 0 until rows.length()) {
                            if (rows.getJSONObject(i).optString("wallet").equals(wallet, true)) {
                                idx = i + 1
                                break
                            }
                        }
                        idx
                    }.getOrNull()
                    summary = WalletSummary(
                        position = position,
                        level = level,
                        availableMm3 = available,
                        fundsEur = progress?.optDouble("eur_earned", 0.0) ?: 0.0,
                        fundsUsd = progress?.optDouble("usd_earned", 0.0) ?: 0.0,
                        fundsCny = progress?.optDouble("cny_earned", 0.0) ?: 0.0,
                    )
                    pendingDaily = computePendingDaily(supabase, wallet)
                }
            }
            delay(45_000)
        }
    }

    val tickerText = if (stormroll) {
        STORMROLL[language] ?: STORMROLL.getValue("en")
    } else {
        if (language == "es") tickerEs else tickerEn
    }
    val tickerColor = if (stormroll) Color(0xFFFACC15) else Color(0xFF86EFAC)

    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0xF5070B0F))
            .border(width = 1.dp, color = Color(0x4D164E63)),
    ) {
        // ── ROW 1: MacroTicker (letrero) ──
        Box(
            Modifier
                .fillMaxWidth()
                .height(28.dp)
                .background(Color(0x99000000))
                .border(width = 1.dp, color = Color(0x334ADE80)),
            contentAlignment = Alignment.CenterStart,
        ) {
            MarqueeTicker(text = tickerText, color = tickerColor)
        }

        // ── ROW 2: pulse+home, then controls (2 lines — fits mobile vertical) ──
        Column(
            Modifier
                .fillMaxWidth()
                .border(width = 1.dp, color = Color(0x26164E63))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PulseBar(
                    war = war,
                    nature = nature,
                    dice = diceNow,
                    active = activeWallets,
                    total = totalWallets,
                )
                HomeBadge(onClick = { onNativeRoute("home") })
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Box {
                    HeaderIconButton(onClick = { currencyOpen = true }) {
                        Text(
                            "${currencySymbol(currency)} ▼",
                            color = Color(0xFF67E8F9),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                        )
                    }
                    DropdownMenu(
                        expanded = currencyOpen,
                        onDismissRequest = { currencyOpen = false },
                        modifier = Modifier.background(Color(0xFF060A12)),
                    ) {
                        listOf("EUR", "USD", "CNY").forEach { cur ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        "${currencySymbol(cur)} $cur",
                                        color = if (currency == cur) Color.Black else Color(0xFF67E8F9),
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                    )
                                },
                                onClick = {
                                    onCurrency(cur)
                                    currencyOpen = false
                                },
                                modifier = Modifier.background(
                                    if (currency == cur) Color(0xFF67E8F9) else Color.Transparent,
                                ),
                            )
                        }
                    }
                }
                Box {
                    HeaderIconButton(onClick = { languageOpen = true }) {
                        Text(
                            "${if (language == "es") "🇪🇸" else "🇬🇧"} ▼",
                            color = Color(0xFF67E8F9),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                        )
                    }
                    DropdownMenu(
                        expanded = languageOpen,
                        onDismissRequest = { languageOpen = false },
                        modifier = Modifier.background(Color(0xFF060A12)),
                    ) {
                        listOf("en" to "🇬🇧 English", "es" to "🇪🇸 Español").forEach { (code, label) ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        label,
                                        color = if (language == code) Color.Black else Color(0xFF67E8F9),
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                    )
                                },
                                onClick = {
                                    onLanguage(code)
                                    languageOpen = false
                                },
                                modifier = Modifier.background(
                                    if (language == code) Color(0xFF67E8F9) else Color.Transparent,
                                ),
                            )
                        }
                    }
                }
                HeaderIconButton(onClick = { onSound(!soundEnabled) }) {
                    Text(
                        if (soundEnabled) "🔊" else "🔇",
                        fontSize = 13.sp,
                        color = if (soundEnabled) Color(0xFF94A3B8) else Color(0xFF64748B),
                    )
                }
                HeaderIconButton(onClick = { onMusic(!musicEnabled) }) {
                    Text(
                        if (musicEnabled) "🎵" else "🎶̸",
                        fontSize = 13.sp,
                        color = if (musicEnabled) Color(0xFF94A3B8) else Color(0xFF64748B),
                    )
                }
                AuthControls(
                    connected = wallet != null,
                    onAuth = onAuth,
                    onDisconnect = onDisconnect,
                )
            }
        }

        // ── ROW 3: clock + perf + daily + wallet summary (logged in/out) ──
        Row(
            Modifier
                .fillMaxWidth()
                .height(28.dp)
                .border(width = 1.dp, color = Color(0x1A164E63))
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text(
                clock,
                color = Color(0xFF67E8F9),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 11.sp,
                letterSpacing = 0.8.sp,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
            PortalPerfOverlay(modifier = Modifier.padding(horizontal = 2.dp))
            Box(
                Modifier
                    .clickable { onNativeRoute("daily") }
                    .padding(horizontal = 4.dp),
            ) {
                Text("🎯", fontSize = 13.sp)
                if (pendingDaily > 0) {
                    Box(
                        Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 6.dp, y = (-6).dp)
                            .size(14.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFD946EF))
                            .border(1.dp, Color(0xFFA5F3FC), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (pendingDaily > 9) "9+" else "$pendingDaily",
                            color = Color.White,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Black,
                            fontSize = 8.sp,
                        )
                    }
                }
            }
            if (wallet != null) {
                val wColor = colorFromAddress(wallet)
                val tier = RankTiers.forLevel(summary?.level ?: 0)
                val money = when (currency.uppercase()) {
                    "USD" -> summary?.fundsUsd ?: 0.0
                    "CNY" -> summary?.fundsCny ?: 0.0
                    else -> summary?.fundsEur ?: 0.0
                }
                Row(
                    Modifier
                        .clickable { onNativeRoute("ranking") }
                        .padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    summary?.position?.let {
                        Text(
                            "#$it",
                            color = Color(0xFF64748B),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Black,
                            fontSize = 10.sp,
                        )
                    }
                    Text(
                        formatWalletLabel(wallet),
                        color = wColor,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 90.dp),
                    )
                    Text(
                        "${summary?.level ?: 0}",
                        color = Color(0xFFFBBF24),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                    Text(tier.emoji, fontSize = 12.sp)
                    Text(
                        String.format(Locale.US, "%.2f", summary?.availableMm3 ?: 0.0),
                        color = Color(0xFFE0F2FE),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                    Text(
                        "MM3",
                        color = Color(0x8C67E8F9),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 8.sp,
                        letterSpacing = 0.6.sp,
                    )
                    Text(
                        "${currencySymbol(currency)}${formatCompactNum(money)}",
                        color = Color(0xFF6EE7B7),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun MarqueeTicker(text: String, color: Color) {
    val density = LocalDensity.current
    val transition = rememberInfiniteTransition(label = "ticker")
    val offset by transition.animateFloat(
        initialValue = 1f,
        targetValue = -1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 55_000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "tickerX",
    )
    Box(Modifier.fillMaxWidth().fillMaxHeight().clip(RoundedCornerShape(0))) {
        Text(
            text,
            color = color,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 12.sp,
            letterSpacing = 1.6.sp,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier
                .align(Alignment.CenterStart)
                .graphicsLayer {
                    translationX = offset * (density.density * 420f)
                    shadowElevation = 0f
                },
        )
    }
}

@Composable
private fun PulseBar(
    war: Int,
    nature: Int,
    dice: xyz.mathsmine3.nativeapp.ui.header.DiceState,
    active: Int,
    total: Int,
) {
    val dicePct = (abs(dice.modifier) * 100).roundToInt()
    val diceSign = if (dice.modifier >= 0) "+" else "−"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PulseChip("🔥", "$war%", Color(0xFFFB7185))
        PulseChip("🌪️", "$nature%", Color(0xFF67E8F9))
        PulseChip(
            "🎲",
            if (dice.active) "$diceSign$dicePct%" else "0%",
            dice.color,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "$active",
                color = Color(0xFF4ADE80),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 12.sp,
            )
            Text(" / ", color = Color(0xFF475569), fontSize = 10.sp)
            Text(
                "$total",
                color = Color(0xFF64748B),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 12.sp,
            )
            Text(
                " wal",
                color = Color(0xFF475569),
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
            )
        }
    }
}

@Composable
private fun PulseChip(emoji: String, value: String, color: Color) {
    Row(
        Modifier.padding(horizontal = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(emoji, fontSize = 12.sp)
        Text(
            value,
            color = color,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Black,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun HomeBadge(onClick: () -> Unit) {
    Box(
        Modifier
            .size(34.dp)
            .clickable(onClick = onClick)
            .drawBehind {
                // cyan drop shadow under gold frame
                drawRect(
                    color = Color(0x4D22D3EE),
                    topLeft = Offset(2.dp.toPx(), 3.dp.toPx()),
                    size = size.copy(width = 30.dp.toPx(), height = 30.dp.toPx()),
                )
            },
    ) {
        Image(
            painter = painterResource(R.drawable.og_image),
            contentDescription = "MathsMine3 home",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(28.dp)
                .offset(x = 0.dp, y = 2.dp)
                .border(1.dp, Color(0xD1FACC15))
                .background(Color(0xFF02060B)),
        )
        // house marker
        Box(
            Modifier
                .size(width = 9.dp, height = 8.dp)
                .offset(x = 17.dp, y = 19.dp)
                .background(Color(0xB801070D))
                .drawBehind {
                    val path = Path().apply {
                        moveTo(1.5f.dp.toPx(), 6.2f.dp.toPx() * (size.height / 8.dp.toPx()))
                        // Scale house path into marker box
                        val sx = size.width / 16f
                        val sy = size.height / 13f
                        reset()
                        moveTo(1.5f * sx, 6.2f * sy)
                        lineTo(8f * sx, 1f * sy)
                        lineTo(14.5f * sx, 6.2f * sy)
                        moveTo(3.5f * sx, 5.2f * sy)
                        lineTo(3.5f * sx, 11.5f * sy)
                        lineTo(12.5f * sx, 11.5f * sy)
                        lineTo(12.5f * sx, 5.2f * sy)
                        moveTo(6.4f * sx, 11.5f * sy)
                        lineTo(6.4f * sx, 7.8f * sy)
                        lineTo(9.6f * sx, 7.8f * sy)
                        lineTo(9.6f * sx, 11.5f * sy)
                    }
                    drawPath(
                        path,
                        color = Color(0xFFFFF4A3),
                        style = Stroke(
                            width = 1.2f,
                            cap = StrokeCap.Square,
                            join = StrokeJoin.Miter,
                        ),
                    )
                },
        )
    }
}

@Composable
private fun HeaderIconButton(
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    Box(
        Modifier
            .height(36.dp)
            .widthIn(min = 36.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp),
        contentAlignment = Alignment.Center,
    ) { content() }
}

@Composable
private fun AuthControls(
    connected: Boolean,
    onAuth: () -> Unit,
    onDisconnect: () -> Unit,
) {
    if (connected) {
        HeaderIconButton(onClick = onDisconnect) {
            Text("⏻", color = Color(0xFF22D3EE), fontSize = 16.sp)
        }
    } else {
        Row(
            Modifier
                .height(28.dp)
                .clip(RoundedCornerShape(4.dp)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .fillMaxHeight()
                    .clickable(onClick = onAuth)
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("G", color = Color(0xFF4285F4), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
            Box(
                Modifier
                    .width(1.dp)
                    .fillMaxHeight()
                    .background(Color(0x33475569)),
            )
            Box(
                Modifier
                    .fillMaxHeight()
                    .clickable(onClick = onAuth)
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("🦊", fontSize = 14.sp)
            }
        }
    }
}

private fun computePendingDaily(supabase: SupabaseRest, wallet: String): Int {
    return runCatching {
        val day = Instant.now().atZone(ZoneOffset.UTC).toLocalDate()
        val start = day.atStartOfDay().toInstant(ZoneOffset.UTC).toString()
        val end = day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).toString()
        val dayKey = day.toString()
        val training = supabase.count(
            "games",
            "wallet=eq.$wallet&is_correct=eq.true&created_at=gte.$start&created_at=lt.$end",
        )
        val trading = supabase.count(
            "mm3_sell_transactions",
            "wallet=eq.$wallet&created_at=gte.$start&created_at=lt.$end",
        )
        val claims = supabase.select(
            "daily_task_claims",
            filter = "wallet=eq.$wallet&day=eq.$dayKey",
            columns = "task_key,reward_claimed",
        )
        val claimed = mutableSetOf<String>()
        for (i in 0 until claims.length()) {
            val row = claims.getJSONObject(i)
            if (row.optBoolean("reward_claimed")) claimed.add(row.optString("task_key"))
        }
        var pending = 0
        if (training >= 25 && "training" !in claimed) pending++
        if (trading >= 5 && "trading" !in claimed) pending++
        pending
    }.getOrDefault(0)
}
