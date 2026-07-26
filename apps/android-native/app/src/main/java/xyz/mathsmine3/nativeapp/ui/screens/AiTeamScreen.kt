package xyz.mathsmine3.nativeapp.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.aiteam.AiBot
import xyz.mathsmine3.nativeapp.aiteam.AiPool
import xyz.mathsmine3.nativeapp.aiteam.AiTeamCatalog
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.header.colorFromAddress
import xyz.mathsmine3.nativeapp.ui.header.colorFromPool
import xyz.mathsmine3.nativeapp.ui.header.formatMm3
import xyz.mathsmine3.nativeapp.ui.header.formatWalletLabel
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import xyz.mathsmine3.nativeapp.ui.theme.RankTiers
import java.util.Locale

private data class BotLiveStats(
    val level: Int = 0,
    val chainPct: Double = 0.0,
    val availableMm3: Double = 0.0,
    val rank: Int = 0,
)

@Composable
fun AiTeamScreen(
    api: Mm3Api,
    language: String = "en",
    onOpenRanking: () -> Unit = {},
) {
    val es = language.startsWith("es", ignoreCase = true)
    val context = LocalContext.current
    var live by remember { mutableStateOf<Map<String, BotLiveStats>>(emptyMap()) }
    var status by remember { mutableStateOf(if (es) "sync…" else "sync…") }

    LaunchedEffect(Unit) {
        val result = withContext(Dispatchers.IO) {
            runCatching {
                // Leaderboard masks wallets — match via formatWalletLabel.
                val labels = AiTeamCatalog.ALL_WALLETS.associateWith { formatWalletLabel(it) }
                val raw = api.leaderboard(page = 1, limit = 200).readText()
                val root = JSONObject(raw)
                val items = root.optJSONArray("items") ?: return@runCatching emptyMap()
                val out = mutableMapOf<String, BotLiveStats>()
                for (i in 0 until items.length()) {
                    val o = items.getJSONObject(i)
                    val masked = o.optString("wallet")
                    val wallet = labels.entries.find { it.value.equals(masked, ignoreCase = true) }?.key
                        ?: continue
                    out[wallet] = BotLiveStats(
                        level = o.optInt("level"),
                        chainPct = o.optDouble("block_chain_percent"),
                        availableMm3 = o.optDouble("available_mm3"),
                        rank = o.optInt("rank"),
                    )
                }
                out
            }
        }
        result.onSuccess {
            live = it
            status = if (es) "live · ${it.size}/4 bots" else "live · ${it.size}/4 bots"
        }.onFailure {
            status = if (es) "roster estático" else "static roster"
        }
    }

    fun openUrl(url: String) {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    Mm3Screen(
        title = "AI TEAM",
        subtitle = status,
    ) {
        Mm3Panel(accent = Color(0xFF86EFAC)) {
            Text(
                "AUTONOMOUS WALLET NETWORK",
                color = Color(0xFF86EFAC),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Black,
                fontSize = 11.sp,
                letterSpacing = 1.5.sp,
            )
            Text(
                if (es) {
                    "Cuatro wallets autónomas activas en MathsMine3 — minan, tradean, lanzan Squeezes y resuelven bloques. No son NPCs. Son tus rivales."
                } else {
                    "Four autonomous wallets operating live inside MathsMine3. Not NPCs. Your rivals."
                },
                color = Mm3Colors.Text,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                lineHeight = 16.sp,
            )
            // Simple avatar row (stand-in for 3D forge)
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                AiTeamCatalog.POOLS.flatMap { it.bots }.forEach { bot ->
                    val c = colorFromAddress(bot.wallet)
                    Box(
                        Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(c.copy(alpha = 0.25f))
                            .border(2.dp, c, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(bot.mapLabel, color = c, fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Mm3Panel(accent = Mm3Colors.Cyan) {
            Text(
                if (es) "⚙️ Protocolos Activos" else "⚙️ Active Protocols",
                color = Mm3Colors.Cyan,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
            )
            Text(
                if (es) {
                    "Minan hasta 100 partidas/día, resuelven MM3 Block Chain, tradean, rotan NFTJIs e inician Squeezes. No simulan la economía — la crean."
                } else {
                    "Mine up to 100 games/day, resolve MM3 Block Chain, trade, rotate NFTJIs, and Squeeze real pools. They don't simulate the economy — they create it."
                },
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                lineHeight = 15.sp,
            )
        }

        AiTeamCatalog.POOLS.forEach { pool ->
            PoolBlock(
                pool = pool,
                live = live,
                onOpenRanking = onOpenRanking,
            )
        }

        Mm3Panel(accent = Mm3Colors.Magenta) {
            Text(
                if (es) "freaking built with" else "freaking built with",
                color = Mm3Colors.Magenta,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                letterSpacing = 1.sp,
            )
            Spacer(Modifier.height(4.dp))
            listOf(
                Triple("AN", "Claude", "https://www.anthropic.com"),
                Triple("OP", "Codex", "https://openai.com"),
                Triple("FK", "@FreakingAI", "https://www.youtube.com/@Freakingai"),
            ).forEach { (mark, name, url) ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { openUrl(url) }
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        Modifier
                            .size(32.dp)
                            .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
                            .background(Mm3Colors.BgDeep, RoundedCornerShape(2.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(mark, color = Mm3Colors.Cyan, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                    }
                    Column {
                        Text(name, color = Mm3Colors.Text, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text(
                            when (mark) {
                                "AN" -> "Anthropic"
                                "OP" -> "OpenAI"
                                else -> "YouTube"
                            },
                            color = Mm3Colors.Muted,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PoolBlock(
    pool: AiPool,
    live: Map<String, BotLiveStats>,
    onOpenRanking: () -> Unit,
) {
    val poolColor = colorFromPool(pool.code)
    Mm3Panel(accent = poolColor) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpenRanking),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("◈", color = poolColor, fontSize = 14.sp)
                Text(
                    "POOL ${pool.code}",
                    color = poolColor,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                    letterSpacing = 1.sp,
                )
            }
            Text(
                "02 NODES",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
        }
        Spacer(Modifier.height(4.dp))
        pool.bots.forEach { bot ->
            BotCard(bot = bot, stats = live[bot.wallet], onOpenRanking = onOpenRanking)
            Spacer(Modifier.height(6.dp))
        }
    }
}

@Composable
private fun BotCard(
    bot: AiBot,
    stats: BotLiveStats?,
    onOpenRanking: () -> Unit,
) {
    val color = colorFromAddress(bot.wallet)
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
            .background(Mm3Colors.BgDeep.copy(alpha = 0.85f), RoundedCornerShape(2.dp))
            .clickable(onClick = onOpenRanking)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(color.copy(alpha = 0.2f))
                    .border(1.dp, color, RoundedCornerShape(2.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(bot.mapLabel, color = color, fontFamily = FontFamily.Monospace, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.weight(1f)) {
                Text(
                    AiTeamCatalog.shortWallet(bot.wallet),
                    color = color,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                )
                Text(
                    "(bot)",
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp,
                )
            }
            if (stats != null && stats.rank > 0) {
                val tier = RankTiers.forLevel(stats.level)
                Text(
                    "#${stats.rank}",
                    color = Mm3Colors.Cyan,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                )
                Text(
                    "${tier.emoji} lv.${stats.level}",
                    color = tier.color,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
            }
        }
        if (stats != null) {
            Text(
                String.format(Locale.US, "%.2f%% · %s MM3", stats.chainPct, formatMm3(stats.availableMm3)),
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
        }
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            bot.tags.forEach { tag ->
                Box(
                    Modifier
                        .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(2.dp))
                        .background(color.copy(alpha = 0.08f), RoundedCornerShape(2.dp))
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                ) {
                    Text(tag, color = color, fontFamily = FontFamily.Monospace, fontSize = 9.sp)
                }
            }
        }
    }
}
