package xyz.mathsmine3.nativeapp.ui.screens

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.data.readText
import xyz.mathsmine3.nativeapp.ui.components.Mm3Button
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

private val Pass = Color(0xFF4ADE80)
private val Warn = Color(0xFFFB923C)
private val Fail = Color(0xFFEF4444)
private val Dim = Color(0xFF71839A)
private val Gray = Color(0xFF94A3B8)

private const val PageSize = 5

private data class SecurityScanSummary(
    val id: Int,
    val triggeredAt: String,
    val triggeredBy: String,
    val status: String,
    val score: Int?,
    val summary: String?,
)

private data class SecurityFindingUi(
    val label: String,
    val status: String?,
    val severity: String?,
    val summary: String?,
    val version: String?,
    val cvss: String?,
    val fixedIn: String?,
    val scoreImpact: String?,
    val responseMs: Int?,
    val actual: String?,
    val expected: String?,
    val aliases: List<String>,
    val url: String?,
    val rationale: String?,
    val attacks: String?,
    val recommended: String?,
    val affectedRange: String?,
    val requestBody: String?,
    val responsePreview: String?,
) {
    val hasExtra: Boolean
        get() = !rationale.isNullOrBlank() ||
            !attacks.isNullOrBlank() ||
            !recommended.isNullOrBlank() ||
            !affectedRange.isNullOrBlank() ||
            requestBody != null ||
            !responsePreview.isNullOrBlank() ||
            aliases.isNotEmpty() ||
            !url.isNullOrBlank()
}

private data class SecurityCheckUi(
    val id: String,
    val name: String,
    val status: String,
    val score: Int?,
    val source: String?,
    val summary: String?,
    val findings: List<SecurityFindingUi>,
)

private data class SecurityScanDetail(
    val id: Int,
    val triggeredAt: String,
    val triggeredBy: String,
    val durationMs: Long?,
    val score: Int?,
    val summary: String?,
    val status: String,
    val checks: List<SecurityCheckUi>,
)

@Composable
fun SecurityAuditScreen(
    api: Mm3Api,
    language: String = "en",
) {
    val es = language.startsWith("es", ignoreCase = true)
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var loading by remember { mutableStateOf(true) }
    var loadingDetailId by remember { mutableStateOf<Int?>(null) }
    var running by remember { mutableStateOf(false) }
    var history by remember { mutableStateOf(emptyList<SecurityScanSummary>()) }
    var selected by remember { mutableStateOf<SecurityScanDetail?>(null) }
    var histPage by remember { mutableIntStateOf(0) }
    var flash by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun loadHistory(preferId: Int? = null) {
        loading = true
        error = null
        try {
            val text = withContext(Dispatchers.IO) { api.securityHistory(limit = 50).readText() }
            val arr = JSONArray(text)
            val rows = buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(
                        SecurityScanSummary(
                            id = o.optInt("id"),
                            triggeredAt = o.optString("triggered_at"),
                            triggeredBy = o.optString("triggered_by"),
                            status = o.optString("status"),
                            score = o.optIntOrNull("score"),
                            summary = o.optStringOrNull("summary"),
                        ),
                    )
                }
            }
            history = rows
            val pick = preferId ?: rows.firstOrNull()?.id
            if (pick != null) {
                loadingDetailId = pick
                selected = loadDetailInternal(api, pick.toString())
            }
        } catch (t: Throwable) {
            error = t.message ?: "error"
        } finally {
            loading = false
            loadingDetailId = null
        }
    }

    suspend fun openDetail(id: Int) {
        if (selected?.id == id) {
            selected = null
            return
        }
        loadingDetailId = id
        error = null
        try {
            selected = loadDetailInternal(api, id.toString())
        } catch (t: Throwable) {
            error = t.message ?: "error"
        } finally {
            loadingDetailId = null
        }
    }

    suspend fun triggerScan() {
        running = true
        flash = if (es) "Ejecutando comprobaciones de seguridad…" else "Running security checks…"
        try {
            val text = withContext(Dispatchers.IO) { api.securityScan().readText() }
            val obj = JSONObject(text)
            when {
                obj.optBoolean("ok") -> {
                    val scanId = obj.optInt("scanId")
                    val score = obj.optInt("score")
                    flash = if (es) {
                        "✓ Análisis completado — Puntuación $score/100"
                    } else {
                        "✓ Scan complete — Score $score/100"
                    }
                    histPage = 0
                    loadHistory(preferId = scanId.takeIf { it > 0 })
                }
                obj.optString("error") == "rate_limited" -> {
                    val retry = obj.optInt("retryAfter", 3600)
                    flash = if (es) {
                        "⏳ Límite de velocidad — reintenta en ${((retry + 59) / 60)} min"
                    } else {
                        "⏳ Rate limited — retry in ${((retry + 59) / 60)} min"
                    }
                }
                else -> {
                    flash = "✗ ${obj.optString("error").ifBlank { "Error" }}"
                }
            }
        } catch (t: Throwable) {
            flash = "✗ ${t.message ?: "error"}"
        } finally {
            running = false
        }
    }

    LaunchedEffect(Unit) { loadHistory() }

    val totalPages = ((history.size + PageSize - 1) / PageSize).coerceAtLeast(1)
    val page = histPage.coerceIn(0, totalPages - 1)
    val pageItems = history.drop(page * PageSize).take(PageSize)

    Mm3Screen(
        title = if (es) "AUDITORÍA DE SEGURIDAD" else "SECURITY AUDIT",
        subtitle = if (es) {
            "solo lectura · mathsmine3.xyz + código público"
        } else {
            "read-only · mathsmine3.xyz + public codebase"
        },
    ) {
        Mm3Panel(accent = Mm3Colors.Cyan) {
            Text(
                if (es) {
                    "Auditoría automatizada dirigida exclusivamente a mathsmine3.xyz y su código en GitHub. " +
                        "20 comprobaciones de solo lectura: TLS, cabeceras, CSP, auth API, CVEs, secretos, inyección, CORS, rate limit y salud de páginas."
                } else {
                    "Automated audit scoped exclusively to mathsmine3.xyz and its GitHub codebase. " +
                        "20 read-only checks: TLS, headers, CSP, API auth, CVEs, secrets, injection, CORS, rate limiting and page health."
                },
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                lineHeight = 16.sp,
            )
            Mm3Button(
                text = when {
                    running && es -> "⟳ ANALIZANDO…"
                    running -> "⟳ SCANNING…"
                    es -> "▶ EJECUTAR ANÁLISIS"
                    else -> "▶ RUN SCAN"
                },
                onClick = { scope.launch { triggerScan() } },
                enabled = !running,
                accent = Mm3Colors.Cyan,
            )
            flash?.let { msg ->
                val color = when {
                    msg.startsWith("✓") -> Pass
                    msg.startsWith("⏳") -> Warn
                    else -> Fail
                }
                Text(msg, color = color, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
        }

        error?.let {
            Mm3Panel(accent = Fail) {
                Text(it, color = Fail, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
        }

        if (loading) {
            Mm3Panel {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    CircularProgressIndicator(
                        color = Mm3Colors.Cyan,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        if (es) "Cargando historial…" else "Loading history…",
                        color = Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                }
            }
        }

        if (!loading && history.isEmpty() && !running) {
            Mm3Panel(accent = Dim) {
                Text(
                    if (es) {
                        "Sin análisis aún — pulsa EJECUTAR ANÁLISIS para comenzar"
                    } else {
                        "No scans yet — press RUN SCAN to start"
                    },
                    color = Gray,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                )
            }
        }

        if (history.isNotEmpty()) {
            Mm3Panel(accent = Gray) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (es) "HISTORIAL (${history.size})" else "SCAN HISTORY (${history.size})",
                        color = Gray,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        letterSpacing = 1.sp,
                    )
                    if (totalPages > 1) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                if (es) "← ant" else "← prev",
                                modifier = Modifier
                                    .border(1.dp, if (page == 0) Dim else Gray.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
                                    .clickable(enabled = page > 0) { histPage = page - 1 }
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                color = if (page == 0) Dim else Gray,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                            )
                            Text(
                                "${page + 1} / $totalPages",
                                color = Gray,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                            )
                            Text(
                                if (es) "sig →" else "next →",
                                modifier = Modifier
                                    .border(
                                        1.dp,
                                        if (page >= totalPages - 1) Dim else Gray.copy(alpha = 0.4f),
                                        RoundedCornerShape(2.dp),
                                    )
                                    .clickable(enabled = page < totalPages - 1) { histPage = page + 1 }
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                color = if (page >= totalPages - 1) Dim else Gray,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                            )
                        }
                    }
                }

                pageItems.forEach { scan ->
                    val accent = scoreColor(scan.score, scan.status)
                    val selectedRow = selected?.id == scan.id
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .border(
                                1.dp,
                                if (selectedRow) accent.copy(alpha = 0.55f) else Color(0xFF1E293B),
                                RoundedCornerShape(4.dp),
                            )
                            .background(if (selectedRow) Color(0xFF0A1628) else Color(0xFF080D1A))
                            .clickable { scope.launch { openDetail(scan.id) } }
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                if (scan.status == "completed" && scan.score != null) {
                                    "${scan.score}/100"
                                } else {
                                    statusLabel(scan.status)
                                },
                                color = accent,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    scan.triggeredBy.uppercase(),
                                    modifier = Modifier
                                        .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(3.dp))
                                        .padding(horizontal = 5.dp, vertical = 1.dp),
                                    color = Gray,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                )
                                if (scan.status == "completed") {
                                    Text(
                                        "↓ PDF",
                                        modifier = Modifier
                                            .border(1.dp, Gray.copy(alpha = 0.4f), RoundedCornerShape(3.dp))
                                            .clickable {
                                                scope.launch {
                                                    try {
                                                        val detail = if (selected?.id == scan.id) {
                                                            selected!!
                                                        } else {
                                                            loadDetailInternal(api, scan.id.toString())
                                                        }
                                                        exportSecurityPdf(context, detail, es)
                                                    } catch (t: Throwable) {
                                                        Toast.makeText(
                                                            context,
                                                            t.message ?: "PDF error",
                                                            Toast.LENGTH_SHORT,
                                                        ).show()
                                                    }
                                                }
                                            }
                                            .padding(horizontal = 8.dp, vertical = 2.dp),
                                        color = Gray,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                    )
                                }
                            }
                        }
                        Text(
                            formatIso(scan.triggeredAt),
                            color = Gray,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                        )
                        scan.summary?.takeIf { it.isNotBlank() }?.let {
                            Text(it, color = Dim, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                        }
                        if (loadingDetailId == scan.id) {
                            Text(
                                if (es) "cargando…" else "loading…",
                                color = Mm3Colors.Cyan,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                            )
                        }
                    }
                }
            }
        }

        selected?.takeIf { it.status == "completed" || it.checks.isNotEmpty() }?.let { detail ->
            Mm3Panel(accent = Mm3Colors.Cyan) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (es) "ANÁLISIS #${detail.id} DETALLE" else "SCAN #${detail.id} DETAIL",
                        color = Mm3Colors.Cyan,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        letterSpacing = 1.sp,
                    )
                    Text(
                        if (es) "↓ EXPORTAR PDF" else "↓ EXPORT PDF",
                        modifier = Modifier
                            .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.4f), RoundedCornerShape(3.dp))
                            .background(Mm3Colors.Cyan.copy(alpha = 0.08f))
                            .clickable {
                                runCatching { exportSecurityPdf(context, detail, es) }
                                    .onFailure {
                                        Toast.makeText(
                                            context,
                                            it.message ?: "PDF error",
                                            Toast.LENGTH_SHORT,
                                        ).show()
                                    }
                            }
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                        color = Mm3Colors.Cyan,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                    )
                }

                ScoreBadge(score = detail.score ?: 0, es = es)
                Text(
                    listOfNotNull(
                        formatIso(detail.triggeredAt),
                        "BY: ${detail.triggeredBy.uppercase()}",
                        detail.durationMs?.let {
                            "DURATION: ${"%.1f".format(Locale.US, it / 1000f)}s"
                        },
                    ).joinToString("  ·  "),
                    color = Gray,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                )
                detail.summary?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = Mm3Colors.Text, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                }
                detail.checks.forEach { check ->
                    CheckCard(check = check)
                }
            }
        }

        Text(
            if (es) {
                "Exclusivo a mathsmine3.xyz · OSV (Google) · Sin terceros · Solo lectura"
            } else {
                "Scoped to mathsmine3.xyz only · OSV (Google) · No third parties · Read-only"
            },
            color = Dim,
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        )
    }
}

@Composable
private fun ScoreBadge(score: Int, es: Boolean) {
    val color = scoreColor(score, "completed")
    val grade = when {
        score >= 90 -> "A"
        score >= 80 -> "B"
        score >= 70 -> "C"
        score >= 50 -> "D"
        else -> "F"
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.padding(vertical = 4.dp),
    ) {
        Box(
            Modifier
                .size(72.dp)
                .border(3.dp, color, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                grade,
                color = color,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
            )
        }
        Column {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    "$score",
                    color = color,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 28.sp,
                )
                Text(
                    "/100",
                    color = Gray,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 4.dp, start = 2.dp),
                )
            }
            Text(
                if (es) "PUNTUACIÓN DE SEGURIDAD" else "SECURITY SCORE",
                color = Gray,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                letterSpacing = 1.sp,
            )
        }
    }
}

@Composable
private fun CheckCard(check: SecurityCheckUi) {
    var open by remember(check.id) { mutableStateOf(false) }
    val color = statusColor(check.status)

    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, color.copy(alpha = 0.28f), RoundedCornerShape(6.dp)),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF0A0F1A))
                .clickable { open = !open }
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    statusLabel(check.status),
                    color = color,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    modifier = Modifier.width(78.dp),
                )
                Text(
                    check.name,
                    color = Mm3Colors.Cyan,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${check.score ?: 0}/100",
                    color = scoreColor(check.score, check.status),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
                Text(
                    if (open) "▲" else "▼",
                    color = Gray,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
            }
        }

        AnimatedVisibility(visible = open) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF060C18))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                check.source?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        "SOURCE: $it",
                        color = Gray,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
                check.summary?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        it,
                        color = Color(0xFF94A3B8),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                    )
                }
                check.findings.forEach { finding ->
                    FindingRow(finding = finding)
                }
            }
        }
    }
}

@Composable
private fun FindingRow(finding: SecurityFindingUi) {
    var open by remember(finding.label, finding.summary) { mutableStateOf(false) }
    val borderColor = when {
        finding.status == "fail" || finding.severity == "CRITICAL" || finding.severity == "HIGH" -> Fail
        finding.status == "pass" || finding.status == "present" -> Pass
        else -> Warn
    }

    Row(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF0A1020), RoundedCornerShape(4.dp)),
    ) {
        Box(
            Modifier
                .width(3.dp)
                .fillMaxHeight()
                .height(48.dp)
                .background(borderColor, RoundedCornerShape(topStart = 4.dp, bottomStart = 4.dp)),
        )
        Column(Modifier.weight(1f)) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = finding.hasExtra) { open = !open }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (!finding.severity.isNullOrBlank() &&
                        finding.status != "present" &&
                        finding.status != "pass"
                    ) {
                        Text(
                            finding.severity.orEmpty(),
                            color = severityColor(finding.severity),
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            modifier = Modifier
                                .border(
                                    1.dp,
                                    severityColor(finding.severity).copy(alpha = 0.3f),
                                    RoundedCornerShape(3.dp),
                                )
                                .padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                    }
                    if (finding.status == "pass" || finding.status == "present") {
                        Text(
                            "✓",
                            color = Pass,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                        )
                    }
                    Text(
                        finding.label,
                        color = Color(0xFFE2E8F0),
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        modifier = Modifier.weight(1f),
                    )
                    finding.version?.let {
                        Text("v$it", color = Gray, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                    }
                    finding.cvss?.let {
                        Text(
                            "CVSS $it",
                            color = severityColor(finding.severity),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                        )
                    }
                    finding.fixedIn?.let {
                        Text("fix: v$it", color = Pass, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                    }
                    if (finding.hasExtra) {
                        Text(
                            if (open) "▲" else "▼",
                            color = Gray,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                        )
                    }
                }
                finding.summary?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        it,
                        color = Color(0xFF64748B),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        lineHeight = 14.sp,
                    )
                }
                finding.actual?.let { actual ->
                    Text(
                        "HTTP $actual (expected: ${finding.expected ?: "—"})",
                        color = Gray,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
                if (finding.aliases.isNotEmpty()) {
                    Text(
                        "CVE: ${finding.aliases.joinToString(", ")}",
                        color = Gray,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
                finding.responseMs?.takeIf { it > 0 }?.let {
                    Text("${it}ms", color = Dim, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                }
                finding.scoreImpact?.let {
                    Text(it, color = Fail, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                }
            }

            AnimatedVisibility(visible = open && finding.hasExtra) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF060C18))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    finding.rationale?.takeIf { it.isNotBlank() }?.let {
                        ExtraLine("WHY IT MATTERS", Mm3Colors.Cyan, it)
                    }
                    finding.attacks?.takeIf { it.isNotBlank() }?.let {
                        ExtraLine("ATTACK VECTORS", Fail, it)
                    }
                    finding.recommended?.takeIf { it.isNotBlank() }?.let {
                        ExtraLine("RECOMMENDED", Pass, it)
                    }
                    finding.affectedRange?.takeIf { it.isNotBlank() }?.let {
                        ExtraLine("AFFECTED RANGE", Warn, it)
                    }
                    finding.requestBody?.let {
                        ExtraLine("REQUEST BODY", Gray, it.ifBlank { "(none)" })
                    }
                    finding.responsePreview?.takeIf { it.isNotBlank() }?.let {
                        ExtraLine("RESPONSE PREVIEW", Gray, it)
                    }
                    finding.url?.takeIf { it.isNotBlank() }?.let {
                        ExtraLine("URL", Mm3Colors.Cyan, it)
                    }
                }
            }
        }
    }
}

@Composable
private fun ExtraLine(label: String, accent: Color, body: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            label,
            color = accent,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp,
            letterSpacing = 1.sp,
        )
        Text(
            body,
            color = Color(0xFF94A3B8),
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            lineHeight = 14.sp,
        )
    }
}

private suspend fun loadDetailInternal(api: Mm3Api, id: String): SecurityScanDetail {
    val text = withContext(Dispatchers.IO) { api.securityHistory(id = id).readText() }
    val obj = JSONObject(text)
    val checksJson = obj.optJSONObject("results")?.optJSONArray("checks") ?: JSONArray()
    val checks = buildList {
        for (i in 0 until checksJson.length()) {
            val c = checksJson.getJSONObject(i)
            val findings = c.optJSONArray("findings") ?: JSONArray()
            add(
                SecurityCheckUi(
                    id = c.optString("id").ifBlank { "${c.optString("name")}-$i" },
                    name = c.optString("name"),
                    status = c.optString("status"),
                    score = c.optIntOrNull("score"),
                    source = c.optStringOrNull("source"),
                    summary = c.optStringOrNull("summary"),
                    findings = buildList {
                        for (j in 0 until findings.length()) {
                            val f = findings.optJSONObject(j) ?: continue
                            val aliases = f.optJSONArray("aliases")?.let { arr ->
                                buildList {
                                    for (k in 0 until arr.length()) add(arr.optString(k))
                                }.filter { it.isNotBlank() }
                            } ?: emptyList()
                            val expected = when (val e = f.opt("expected")) {
                                is JSONArray -> buildList {
                                    for (k in 0 until e.length()) add(e.optString(k))
                                }.joinToString(" / ")
                                null, JSONObject.NULL -> null
                                else -> e.toString()
                            }
                            add(
                                SecurityFindingUi(
                                    label = f.optString("label")
                                        .ifBlank { f.optString("package") }
                                        .ifBlank { f.optString("endpoint") }
                                        .ifBlank { f.optString("header") }
                                        .ifBlank { f.optString("id") }
                                        .ifBlank { "finding-$j" },
                                    status = f.optStringOrNull("status"),
                                    severity = f.optStringOrNull("severity"),
                                    summary = f.optStringOrNull("summary"),
                                    version = f.optStringOrNull("version"),
                                    cvss = f.opt("cvss")?.takeIf { it != JSONObject.NULL }?.toString(),
                                    fixedIn = f.optStringOrNull("fixedIn"),
                                    scoreImpact = f.optStringOrNull("scoreImpact"),
                                    responseMs = f.optIntOrNull("responseMs"),
                                    actual = f.opt("actual")?.takeIf { it != JSONObject.NULL }?.toString(),
                                    expected = expected,
                                    aliases = aliases,
                                    url = f.optStringOrNull("url"),
                                    rationale = f.optStringOrNull("rationale"),
                                    attacks = f.optStringOrNull("attacks"),
                                    recommended = f.optStringOrNull("recommended"),
                                    affectedRange = f.optStringOrNull("affectedRange"),
                                    requestBody = if (f.has("requestBody") && !f.isNull("requestBody")) {
                                        f.opt("requestBody")?.toString()
                                    } else {
                                        null
                                    },
                                    responsePreview = f.optStringOrNull("responsePreview"),
                                ),
                            )
                        }
                    },
                ),
            )
        }
    }
    return SecurityScanDetail(
        id = obj.optInt("id"),
        triggeredAt = obj.optString("triggered_at"),
        triggeredBy = obj.optString("triggered_by"),
        durationMs = obj.optLongOrNull("duration_ms"),
        score = obj.optIntOrNull("score"),
        summary = obj.optStringOrNull("summary"),
        status = obj.optString("status"),
        checks = checks,
    )
}

private fun exportSecurityPdf(context: Context, scan: SecurityScanDetail, es: Boolean) {
    val doc = PdfDocument()
    val pageWidth = 595
    val pageHeight = 842
    val margin = 36
    val paintTitle = Paint().apply {
        color = android.graphics.Color.parseColor("#22D3EE")
        textSize = 14f
        isFakeBoldText = true
    }
    val paintBody = Paint().apply {
        color = android.graphics.Color.parseColor("#94A3B8")
        textSize = 9f
    }
    val paintCheck = Paint().apply {
        color = android.graphics.Color.parseColor("#E2E8F0")
        textSize = 10f
        isFakeBoldText = true
    }
    val paintMuted = Paint().apply {
        color = android.graphics.Color.parseColor("#64748B")
        textSize = 8f
    }

    var pageNumber = 1
    var pageInfo = doc.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
    var canvas = pageInfo.canvas
    var y = 48f

    fun fillBg() {
        val bg = Paint().apply { color = android.graphics.Color.parseColor("#060918") }
        canvas.drawRect(0f, 0f, pageWidth.toFloat(), pageHeight.toFloat(), bg)
    }

    fun newPage() {
        doc.finishPage(pageInfo)
        pageNumber += 1
        pageInfo = doc.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
        canvas = pageInfo.canvas
        fillBg()
        y = 40f
    }

    fun ensureSpace(needed: Float) {
        if (y + needed > pageHeight - 40) newPage()
    }

    fun drawWrapped(text: String, paint: Paint, maxWidth: Float) {
        val words = text.split(' ')
        var line = ""
        for (w in words) {
            val trial = if (line.isEmpty()) w else "$line $w"
            if (paint.measureText(trial) > maxWidth) {
                ensureSpace(12f)
                canvas.drawText(line, margin.toFloat(), y, paint)
                y += 12f
                line = w
            } else {
                line = trial
            }
        }
        if (line.isNotEmpty()) {
            ensureSpace(12f)
            canvas.drawText(line, margin.toFloat(), y, paint)
            y += 12f
        }
    }

    fillBg()
    canvas.drawText(
        if (es) "MATHSMINE3 · INFORME DE SEGURIDAD" else "MATHSMINE3 · SECURITY AUDIT REPORT",
        margin.toFloat(),
        y,
        paintTitle,
    )
    y += 18f
    canvas.drawText(
        "Scan #${scan.id} · ${formatIso(scan.triggeredAt)} · ${scan.triggeredBy.uppercase()} · score ${scan.score ?: 0}/100",
        margin.toFloat(),
        y,
        paintMuted,
    )
    y += 22f
    scan.summary?.let {
        drawWrapped(it, paintBody, (pageWidth - margin * 2).toFloat())
        y += 8f
    }

    for (check in scan.checks) {
        ensureSpace(40f)
        val statusPaint = Paint(paintCheck).apply {
            color = when (check.status) {
                "pass", "present" -> android.graphics.Color.parseColor("#4ADE80")
                "warn" -> android.graphics.Color.parseColor("#FB923C")
                else -> android.graphics.Color.parseColor("#EF4444")
            }
        }
        canvas.drawText(
            "${statusLabel(check.status)}  ${check.name}  ${check.score ?: 0}/100",
            margin.toFloat(),
            y,
            statusPaint,
        )
        y += 14f
        check.summary?.let {
            drawWrapped(it, paintBody, (pageWidth - margin * 2).toFloat())
        }
        for (f in check.findings.take(12)) {
            val line = listOfNotNull(f.label, f.severity, f.summary?.take(80)).joinToString(" · ")
            drawWrapped("• $line", paintMuted, (pageWidth - margin * 2).toFloat())
        }
        if (check.findings.size > 12) {
            canvas.drawText(
                "  ... +${check.findings.size - 12} more",
                margin.toFloat(),
                y,
                paintMuted,
            )
            y += 12f
        }
        y += 8f
    }

    ensureSpace(20f)
    canvas.drawText(
        "mathsmine3.xyz · read-only probes · no third parties",
        margin.toFloat(),
        (pageHeight - 24).toFloat(),
        paintMuted,
    )
    doc.finishPage(pageInfo)

    val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(System.currentTimeMillis())
    val out = File(context.cacheDir, "security-audit-${scan.id}-$date.pdf")
    FileOutputStream(out).use { doc.writeTo(it) }
    doc.close()

    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", out)
    val share = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, "MathsMine3 Security Audit #${scan.id}")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(share, if (es) "Exportar PDF" else "Export PDF"))
}

private fun statusLabel(status: String): String = when (status) {
    "pass", "present" -> "✓ PASS"
    "warn" -> "⚠ WARN"
    "fail", "error", "failed" -> "✗ FAIL"
    "running" -> "⟳ RUNNING"
    "completed" -> "DONE"
    else -> status.uppercase()
}

private fun statusColor(status: String): Color = when (status) {
    "pass", "present" -> Pass
    "warn" -> Warn
    "fail", "error", "failed" -> Fail
    "running" -> Mm3Colors.Cyan
    else -> Gray
}

private fun scoreColor(score: Int?, status: String): Color = when {
    status == "running" -> Mm3Colors.Cyan
    score != null && score >= 80 -> Pass
    score != null && score >= 50 -> Warn
    score != null -> Fail
    else -> statusColor(status)
}

private fun severityColor(severity: String?): Color = when (severity) {
    "CRITICAL", "HIGH" -> Fail
    "MEDIUM" -> Warn
    "LOW" -> Gray
    else -> Gray
}

private fun formatIso(raw: String): String {
    if (raw.isBlank()) return "—"
    return runCatching {
        val parsers = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            },
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            },
        )
        val date = parsers.firstNotNullOfOrNull { p -> runCatching { p.parse(raw) }.getOrNull() }
            ?: return raw
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(date)
    }.getOrDefault(raw)
}

private fun JSONObject.optStringOrNull(key: String): String? =
    optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun JSONObject.optIntOrNull(key: String): Int? =
    if (!has(key) || isNull(key)) null else optInt(key)

private fun JSONObject.optLongOrNull(key: String): Long? =
    if (!has(key) || isNull(key)) null else optLong(key)
