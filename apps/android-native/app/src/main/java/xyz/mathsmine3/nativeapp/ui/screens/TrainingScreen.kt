package xyz.mathsmine3.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.SupabaseRest
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.training.TrainingProblem
import xyz.mathsmine3.nativeapp.training.TrainingRules
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import xyz.mathsmine3.nativeapp.ui.theme.RankTiers
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.max

private enum class TrainPhase { Loading, Ready, Countdown, Answering, Resolved }

private data class NftjiSlot(val emoji: String, val level: Int?, val owned: Boolean)

@Composable
fun TrainingScreen(
    session: Session,
    api: Mm3Api,
    supabase: SupabaseRest,
    language: String = "en",
) {
    val scope = rememberCoroutineScope()
    val wallet = session.wallet?.lowercase()
    val lang = if (language.startsWith("es", ignoreCase = true)) "es" else "en"

    var phase by remember { mutableStateOf(TrainPhase.Loading) }
    var level by remember { mutableIntStateOf(0) }
    var problem by remember { mutableStateOf<TrainingProblem?>(null) }
    var message by remember { mutableStateOf("Loading…") }
    var countdown by remember { mutableIntStateOf(0) }
    var elapsedMs by remember { mutableIntStateOf(0) }
    var startedAt by remember { mutableLongStateOf(0L) }
    var lastCorrect by remember { mutableStateOf<Boolean?>(null) }
    var lastReward by remember { mutableStateOf(0.0) }
    var drillLeft by remember { mutableIntStateOf(100) }
    var drillTotal by remember { mutableIntStateOf(100) }
    var execs by remember { mutableIntStateOf(0) }
    var nftjis by remember { mutableStateOf(emptyList<NftjiSlot>()) }
    var answeringLocked by remember { mutableStateOf(false) }

    val tier = RankTiers.forLevel(level)
    val noSlots = wallet != null && drillLeft <= 0

    fun refreshSlots() {
        if (wallet == null || !supabase.configured) {
            drillTotal = TrainingRules.DAILY_MINE_BASE
            drillLeft = TrainingRules.DAILY_MINE_BASE
            return
        }
        val start = utcDayStartIso()
        val used = supabase.count("games", "wallet=eq.$wallet&created_at=gte.$start")
        execs = supabase.count("mm3_sell_transactions", "wallet=eq.$wallet")
        drillTotal = TrainingRules.DAILY_MINE_BASE + execs
        drillLeft = max(0, drillTotal - used)
    }

    fun loadNftjis(progress: JSONObject?) {
        val emojis = progress?.optJSONArray("wallet_emojis").toStringList()
        val owned = emojis.toSet()
        fun lvl(key: String) = progress?.optInt(key, 0) ?: 0
        nftjis = listOf(
            NftjiSlot("🔮", lvl("lucky_50_level").takeIf { "🔮" in owned }, "🔮" in owned),
            NftjiSlot("🍀", lvl("lucky_100_level").takeIf { "🍀" in owned }, "🍀" in owned),
            NftjiSlot("🎰", lvl("lucky_500_level").takeIf { "🎰" in owned }, "🎰" in owned),
            NftjiSlot("🧿", lvl("lucky_1000_level").takeIf { "🧿" in owned }, "🧿" in owned),
            NftjiSlot("❤️", 0.takeIf { "❤️" in owned }, "❤️" in owned),
            NftjiSlot("🛰", null, "🛰" in owned),
            NftjiSlot("🔁", null, "🔁" in owned),
            NftjiSlot("🔰", null, false),
            NftjiSlot("⚔️", null, false),
            NftjiSlot("👾", progress?.optInt("zero_day_level", -1)?.takeIf { it >= 0 && "👾" in owned }, "👾" in owned),
            NftjiSlot("⬡", null, !progress?.optString("mining_nftji_key").isNullOrBlank()),
        )
    }

    fun newProblem() {
        problem = TrainingRules.generate(level, lang)
        lastCorrect = null
        answeringLocked = false
        elapsedMs = 0
    }

    fun startCountdown() {
        if (noSlots) {
            message = "No drill slots left today"
            return
        }
        newProblem()
        phase = TrainPhase.Countdown
        countdown = 3
    }

    suspend fun persistGame(correct: Boolean, choice: String, reward: Double, nextLevel: Int) {
        if (wallet == null) return
        val p = problem ?: return
        withContext(Dispatchers.IO) {
            runCatching {
                val raw = api.trainingResolve(
                    jsonBody {
                        put("user_answer", choice)
                        put("time_ms", elapsedMs)
                        put("level_before", level)
                        put(
                            "problem",
                            JSONObject()
                                .put("masked", p.masked)
                                .put("answer", p.answer)
                                .put("difficulty", p.difficulty)
                                .put("problem_type", p.problemType)
                                .put("id", p.id),
                        )
                    },
                ).readText()
                val json = JSONObject(raw)
                if (!json.optBoolean("ok")) {
                    error(json.optString("error", "training_failed"))
                }
                level = json.optInt("level", nextLevel)
            }.onFailure {
                message = it.message ?: "save failed"
            }
            refreshSlots()
        }
    }

    fun submitAnswer(choice: String) {
        val p = problem ?: return
        if (answeringLocked || phase != TrainPhase.Answering) return
        answeringLocked = true
        val correct = choice.trim() == p.answer.trim()
        val reward = if (correct) TrainingRules.miningReward(elapsedMs, level) else 0.0
        val nextLevel = TrainingRules.clampLevel(
            if (correct) level + TrainingRules.successDelta(level)
            else level - TrainingRules.failPenalty(level),
        )
        lastCorrect = correct
        lastReward = reward
        level = nextLevel
        message = if (correct) {
            "CORRECT · ${"%.8f".format(reward)} MM3 · Lv $nextLevel"
            } else {
                "WRONG · chain broken · Lv $nextLevel"
            }
        phase = TrainPhase.Resolved
        scope.launch {
            persistGame(correct, choice, reward, nextLevel)
        }
    }

    LaunchedEffect(wallet) {
        phase = TrainPhase.Loading
        withContext(Dispatchers.IO) {
            runCatching {
                if (wallet != null && supabase.configured) {
                    val progress = supabase.selectOne("player_progress", "wallet=eq.$wallet")
                    level = progress?.optInt("level", 0) ?: 0
                    loadNftjis(progress)
                    refreshSlots()
                } else {
                    level = 0
                    nftjis = emptyList()
                    drillLeft = 100
                    drillTotal = 100
                }
            }.onFailure {
                message = it.message ?: "load error"
            }
        }
        newProblem()
        phase = TrainPhase.Ready
        message = if (wallet == null) "Guest practice · Start" else "Ready · Start"
    }

    LaunchedEffect(phase, countdown) {
        if (phase != TrainPhase.Countdown) return@LaunchedEffect
        if (countdown > 0) {
            delay(1000)
            countdown -= 1
        } else {
            startedAt = System.currentTimeMillis()
            elapsedMs = 0
            phase = TrainPhase.Answering
        }
    }

    LaunchedEffect(phase, startedAt) {
        if (phase != TrainPhase.Answering) return@LaunchedEffect
        val limit = TrainingRules.getTimeLimitMs(level)
        while (phase == TrainPhase.Answering) {
            delay(50)
            elapsedMs = (System.currentTimeMillis() - startedAt).toInt()
            if (elapsedMs >= limit) {
                submitAnswer("")
                break
            }
        }
    }

    Mm3Screen(
        title = "TRAINING",
        subtitle = "${tier.emoji} ${tier.label} · Lv $level · drills $drillLeft/$drillTotal",
    ) {
        // NFTJI strip
        Mm3Panel(accent = tier.color) {
            Text("NFTJI", color = tier.color.copy(alpha = 0.7f), fontFamily = FontFamily.Monospace, fontSize = 10.sp)
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                val slots = if (nftjis.isEmpty()) {
                    List(11) { NftjiSlot("·", null, false) }
                } else nftjis
                slots.take(11).forEach { slot ->
                    Box(
                        Modifier
                            .weight(1f)
                            .height(46.dp)
                            .border(
                                1.dp,
                                if (slot.owned) tier.color.copy(alpha = 0.65f) else Mm3Colors.Muted.copy(alpha = 0.25f),
                                RoundedCornerShape(4.dp),
                            )
                            .background(Mm3Colors.PanelSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                if (slot.owned) slot.emoji else "",
                                fontSize = 14.sp,
                            )
                            if (slot.owned && slot.level != null) {
                                Text("Lv${slot.level}", color = tier.color, fontFamily = FontFamily.Monospace, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        Mm3Panel(accent = if (noSlots) Mm3Colors.Danger else tier.color) {
            Text(
                "DRILL SLOTS",
                color = (if (noSlots) Mm3Colors.Danger else tier.color).copy(alpha = 0.75f),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
            )
            Text(
                "#${drillLeft.toString(16).uppercase()}/100+#${execs.toString(16).uppercase()}",
                color = if (noSlots) Mm3Colors.Danger else tier.color,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
        }

        Mm3Panel(accent = when (lastCorrect) {
            true -> Mm3Colors.Green
            false -> Mm3Colors.Danger
            null -> tier.color
        }) {
            when (phase) {
                TrainPhase.Loading -> Text("Loading…", color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace)
                TrainPhase.Ready, TrainPhase.Resolved -> {
                    if (phase == TrainPhase.Resolved) {
                        Text(
                            message,
                            color = if (lastCorrect == true) Mm3Colors.Green else Mm3Colors.Danger,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                    Mm3Button(
                        text = if (noSlots) "NO DRILL SLOTS" else if (phase == TrainPhase.Ready && level == 0) "▶ START" else "▶ NEXT BLOCK",
                        onClick = { startCountdown() },
                        accent = if (noSlots) Mm3Colors.Danger else tier.color,
                        enabled = !noSlots,
                    )
                }
                TrainPhase.Countdown -> {
                    Text(
                        problem?.question ?: "",
                        color = tier.color,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(
                        "$countdown",
                        color = tier.color,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 48.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                TrainPhase.Answering -> {
                    val limit = TrainingRules.getTimeLimitMs(level).coerceAtLeast(1)
                    val pct = (elapsedMs.toFloat() / limit).coerceIn(0f, 1f)
                    Text(
                        problem?.question ?: "",
                        color = tier.color,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    LinearProgressIndicator(
                        progress = { 1f - pct },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp),
                        color = if (pct > 0.8f) Mm3Colors.Danger else tier.color,
                        trackColor = Mm3Colors.PanelSoft,
                    )
                    Spacer(Modifier.height(6.dp))
                    val choices = problem?.choices.orEmpty()
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        choices.chunked(2).forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                                row.forEach { choice ->
                                    Box(
                                        Modifier
                                            .weight(1f)
                                            .border(1.dp, tier.color.copy(alpha = 0.45f), RoundedCornerShape(4.dp))
                                            .clickable(enabled = !answeringLocked) { submitAnswer(choice) }
                                            .padding(vertical = 12.dp),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            choice,
                                            color = tier.color,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                        )
                                    }
                                }
                                if (row.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
            if (phase != TrainPhase.Resolved && message.isNotBlank() && phase != TrainPhase.Answering) {
                Text(message, color = Mm3Colors.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
        }
    }
}

private fun utcDayStartIso(): String {
    val start = ZonedDateTime.now(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC)
    return DateTimeFormatter.ISO_INSTANT.format(start.toInstant())
}

private fun JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    return buildList {
        for (i in 0 until length()) add(optString(i))
    }
}
