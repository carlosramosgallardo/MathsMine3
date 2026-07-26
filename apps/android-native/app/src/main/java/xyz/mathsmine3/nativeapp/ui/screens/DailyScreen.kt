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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
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
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.daily.DailyTaskDef
import xyz.mathsmine3.nativeapp.daily.DailyTasks
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.SupabaseRest
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.header.formatWalletLabel
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import java.time.Duration
import java.time.Instant

@Composable
fun DailyScreen(
    session: Session,
    api: Mm3Api,
    supabase: SupabaseRest,
    currency: String = "EUR",
    language: String = "en",
) {
    val es = language.startsWith("es", ignoreCase = true)
    val wallet = session.wallet?.lowercase()?.takeIf { it.isNotBlank() }
    var counts by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    val claimed = remember { mutableStateMapOf<String, Boolean>() }
    var dayKey by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf(0) }
    var countdown by remember { mutableStateOf("00:00:00") }
    var message by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var claimingKey by remember { mutableStateOf<String?>(null) }
    val expanded = remember { mutableStateMapOf<String, Boolean>() }
    val scope = rememberCoroutineScope()

    fun reload() {
        if (wallet == null || !supabase.configured) {
            counts = emptyMap()
            claimed.clear()
            dayKey = ""
            pending = 0
            if (wallet == null) {
                message = if (es) {
                    "Conecta una wallet para ver las tareas diarias."
                } else {
                    "Connect a wallet to view daily tasks."
                }
            }
            return
        }
        loading = true
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { DailyTasks.loadProgress(supabase, wallet) }
            }
            result.onSuccess { progress ->
                counts = progress.counts
                claimed.clear()
                claimed.putAll(progress.claimed)
                dayKey = progress.dayKey
                pending = progress.pendingRewards
                message = ""
            }.onFailure {
                message = if (es) {
                    "No se pudo cargar el progreso diario."
                } else {
                    "Could not load daily task progress."
                }
            }
            loading = false
        }
    }

    LaunchedEffect(wallet, supabase.configured) {
        reload()
        while (isActive) {
            delay(120_000)
            reload()
        }
    }

    LaunchedEffect(Unit) {
        while (isActive) {
            val end = Instant.parse(DailyTasks.utcDayBounds().endIso)
            val remaining = Duration.between(Instant.now(), end).coerceAtLeast(Duration.ZERO)
            val totalSec = remaining.seconds
            val h = totalSec / 3600
            val m = (totalSec % 3600) / 60
            val s = totalSec % 60
            countdown = "%02d:%02d:%02d".format(h, m, s)
            delay(1_000)
        }
    }

    fun claim(task: DailyTaskDef) {
        if (wallet == null || claimingKey != null) return
        if (!session.hasApiSession) {
            message = if (es) {
                "Reclamar requiere sesión API · vuelve a entrar con Google"
            } else {
                "Claim needs API session · sign in again with Google"
            }
            return
        }
        claimingKey = task.key
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    JSONObject(
                        api.claimDaily(
                            jsonBody {
                                put("wallet", wallet)
                                put("taskKey", task.key)
                            },
                        ).readText(),
                    )
                }
            }
            result.onSuccess { data ->
                if (data.optBoolean("ok")) {
                    claimed[task.key] = true
                    pending = DailyTasks.CATALOG.count { t ->
                        (counts[t.key] ?: 0) >= t.target && claimed[t.key] != true
                    }
                    message = if (es) {
                        "Recompensa reclamada. Fondos añadidos a tu wallet."
                    } else {
                        "Reward claimed. Funds added to your wallet."
                    }
                } else {
                    val err = data.optString("error")
                    message = when (err) {
                        "already_claimed" -> if (es) "Ya reclamado" else "Already claimed"
                        "task_not_complete" -> if (es) "Tarea incompleta" else "Task not complete"
                        "unauthorized" -> if (es) "No autorizado · sesión" else "Unauthorized · session"
                        else -> if (es) "Error al reclamar :: $err" else "Claim failed :: $err"
                    }
                }
            }.onFailure {
                message = if (es) "Error al reclamar. Intenta de nuevo." else "Claim failed. Try again."
            }
            claimingKey = null
        }
    }

    val sections = remember {
        DailyTasks.CATALOG.groupBy { it.section }.entries.toList()
    }

    Mm3Screen(
        title = "DAILY TASKS",
        subtitle = buildString {
            if (dayKey.isNotBlank()) append("day $dayKey · ")
            append(if (es) "reset en $countdown UTC" else "reset in $countdown UTC")
            if (pending > 0) append(" · pending #$pending")
            if (wallet != null) append(" · ${formatWalletLabel(wallet)}")
        },
    ) {
        if (wallet != null) {
            Mm3Panel(accent = Mm3Colors.Cyan) {
                Text(
                    if (es) "Las recompensas no reclamadas se pierden." else "Unclaimed rewards disappear.",
                    color = Mm3Colors.Cyan,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                )
                Text(
                    if (es) "Reset en $countdown UTC" else "Reset in $countdown UTC",
                    color = Mm3Colors.Green,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
            }
        }

        if (wallet == null) {
            Mm3Panel(accent = Mm3Colors.Magenta) {
                Text(
                    message.ifBlank {
                        if (es) "Conecta una wallet para ver las tareas diarias."
                        else "Connect a wallet to view daily tasks."
                    },
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
            }
        } else {
            Mm3Button(
                text = if (loading) "…" else if (es) "Actualizar" else "Refresh",
                accent = Mm3Colors.Magenta,
                enabled = !loading && claimingKey == null,
                onClick = { reload() },
            )

            sections.forEach { (section, tasks) ->
                val accent = Color(DailyTasks.sectionAccent(section))
                Text(
                    section.uppercase(),
                    color = accent,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Black,
                    fontSize = 10.sp,
                    letterSpacing = 1.5.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(accent.copy(alpha = 0.25f)),
                )
                tasks.forEach { task ->
                    val value = counts[task.key] ?: 0
                    val isClaimed = claimed[task.key] == true
                    val complete = value >= task.target
                    val filled = ((value.toDouble() / task.target) * 100).toInt().coerceIn(0, 100)
                    val highValue = task.key == "mining_chain" || task.key == "pvp_hit"
                    val isExpanded = expanded[task.key] == true

                    if (isClaimed && !isExpanded) {
                        ClaimedRow(
                            name = DailyTasks.taskName(task.key, es),
                            reward = DailyTasks.formatReward(task.rewardEur, currency),
                            onExpand = { expanded[task.key] = true },
                        )
                    } else {
                        TaskCard(
                            name = DailyTasks.taskName(task.key, es),
                            hint = DailyTasks.taskHint(task.key, es),
                            rewardLabel = if (es) "Recompensa" else "Reward",
                            reward = DailyTasks.formatReward(task.rewardEur, currency),
                            value = value,
                            target = task.target,
                            filled = filled,
                            complete = complete,
                            claimed = isClaimed,
                            highValue = highValue,
                            claimLabel = when {
                                isClaimed -> if (es) "Reclamado" else "Claimed"
                                else -> if (es) "Reclamar" else "Claim"
                            },
                            claiming = claimingKey == task.key,
                            onClaim = { claim(task) },
                            onCollapse = if (isClaimed) {
                                { expanded[task.key] = false }
                            } else null,
                        )
                    }
                }
            }
        }

        if (message.isNotBlank()) {
            Mm3Panel(accent = Mm3Colors.CyanDim) {
                Text(message, color = Mm3Colors.CyanDim, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun ClaimedRow(name: String, reward: String, onExpand: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.12f), RoundedCornerShape(2.dp))
            .background(Mm3Colors.BgDeep.copy(alpha = 0.85f), RoundedCornerShape(2.dp))
            .clickable(onClick = onExpand)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("✓", color = Mm3Colors.Green, fontSize = 12.sp)
        Text(
            name,
            color = Mm3Colors.Muted,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            letterSpacing = 1.sp,
        )
        Text("·", color = Mm3Colors.Muted.copy(alpha = 0.5f))
        Text("+$reward", color = Mm3Colors.Green.copy(alpha = 0.75f), fontFamily = FontFamily.Monospace, fontSize = 10.sp)
        Spacer(Modifier.weight(1f))
        Text("▼", color = Mm3Colors.Muted.copy(alpha = 0.5f), fontSize = 10.sp)
    }
}

@Composable
private fun TaskCard(
    name: String,
    hint: String,
    rewardLabel: String,
    reward: String,
    value: Int,
    target: Int,
    filled: Int,
    complete: Boolean,
    claimed: Boolean,
    highValue: Boolean,
    claimLabel: String,
    claiming: Boolean,
    onClaim: () -> Unit,
    onCollapse: (() -> Unit)?,
) {
    val border = if (highValue) Mm3Colors.Green.copy(alpha = 0.35f) else Mm3Colors.Cyan.copy(alpha = 0.2f)
    val titleColor = if (highValue) Mm3Colors.Green else Mm3Colors.Magenta
    Mm3Panel(accent = if (highValue) Mm3Colors.Green else Mm3Colors.Cyan) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        name,
                        color = titleColor,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        letterSpacing = 1.2.sp,
                    )
                    if (onCollapse != null) {
                        Text(
                            "▲",
                            color = Mm3Colors.Muted,
                            fontSize = 10.sp,
                            modifier = Modifier.clickable(onClick = onCollapse),
                        )
                    }
                }
                Text(hint, color = Mm3Colors.Text, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "$rewardLabel $reward",
                    color = Mm3Colors.Green,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
                val enabled = complete && !claimed && !claiming
                Box(
                    Modifier
                        .border(
                            1.dp,
                            when {
                                claimed -> Mm3Colors.Green.copy(alpha = 0.45f)
                                complete -> if (highValue) Mm3Colors.Green.copy(alpha = 0.65f) else Mm3Colors.Cyan.copy(alpha = 0.65f)
                                else -> Mm3Colors.Muted.copy(alpha = 0.25f)
                            },
                            RoundedCornerShape(2.dp),
                        )
                        .background(
                            when {
                                claimed -> Mm3Colors.Green.copy(alpha = 0.1f)
                                complete -> if (highValue) Mm3Colors.Green.copy(alpha = 0.12f) else Mm3Colors.Cyan.copy(alpha = 0.12f)
                                else -> Mm3Colors.BgDeep
                            },
                            RoundedCornerShape(2.dp),
                        )
                        .clickable(enabled = enabled, onClick = onClaim)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Text(
                        if (claiming) "…" else claimLabel.uppercase(),
                        color = when {
                            claimed -> Mm3Colors.Green
                            complete -> if (highValue) Mm3Colors.Green else Mm3Colors.Cyan
                            else -> Mm3Colors.Muted
                        },
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        letterSpacing = 1.sp,
                    )
                }
            }
        }
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                "$value / $target",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
            )
            Text(
                "$filled%",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(6.dp)
                .border(1.dp, border.copy(alpha = 0.35f), RoundedCornerShape(1.dp))
                .background(Mm3Colors.BgDeep, RoundedCornerShape(1.dp)),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(filled / 100f)
                    .height(6.dp)
                    .background(
                        Brush.horizontalGradient(
                            if (highValue) {
                                listOf(Color(0xFF047857), Mm3Colors.Green, Color(0xFF86EFAC))
                            } else {
                                listOf(Mm3Colors.Magenta, Mm3Colors.Cyan, Mm3Colors.Green)
                            },
                        ),
                        RoundedCornerShape(1.dp),
                    ),
            )
        }
    }
}
