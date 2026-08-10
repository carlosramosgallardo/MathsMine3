package xyz.mathsmine3.nativeapp.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.Normalizer
import kotlinx.coroutines.launch
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.mm3PortalBackground
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

private sealed class MdBlock {
    data class H(val level: Int, val text: String, val id: String) : MdBlock()
    data class P(val text: String) : MdBlock()
    data class Li(val ordered: Boolean, val text: String) : MdBlock()
    data class Code(val text: String) : MdBlock()
    data class Quote(val text: String) : MdBlock()
    data class Table(val rows: List<List<String>>) : MdBlock()
    data object Hr : MdBlock()
}

@Composable
fun ManifestoScreen(language: String = "en") {
    val es = language.startsWith("es", ignoreCase = true)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    val blocks = remember(es) {
        val asset = if (es) "manifesto_es.md" else "manifesto_en.md"
        parseMarkdown(loadAsset(context, asset))
    }
    // Map every plausible anchor form → LazyColumn item index (header offset = +2).
    val anchorToIndex = remember(blocks) {
        val map = linkedMapOf<String, Int>()
        blocks.forEachIndexed { i, block ->
            if (block is MdBlock.H) {
                val itemIndex = i + 2
                listOf(block.id, slugify(block.text), slugifyKeepAccents(block.text))
                    .distinct()
                    .forEach { key -> map.putIfAbsent(key, itemIndex) }
            }
        }
        map
    }

    fun jumpToAnchor(raw: String) {
        val key = raw.removePrefix("#").trim()
        val stripped = key.replace(Regex("-\\d+$"), "")
        val index = anchorToIndex[key]
            ?: anchorToIndex[slugify(key)]
            ?: anchorToIndex[slugifyKeepAccents(key)]
            ?: if (stripped != key) {
                anchorToIndex[stripped]
                    ?: anchorToIndex[slugify(stripped)]
                    ?: anchorToIndex[slugifyKeepAccents(stripped)]
            } else {
                null
            }
            ?: return
        scope.launch {
            listState.animateScrollToItem(index)
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxSize()
            .mm3PortalBackground(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                if (es) "▸ MANIFIESTO" else "▸ MANIFESTO",
                style = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = Mm3Colors.Cyan,
                    letterSpacing = 1.sp,
                ),
            )
            Text(
                if (es) "guía completa del juego" else "full game guide",
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
            )
        }
        item {
            Mm3Panel(accent = Color(0xFF94A3B8)) {
                Text(
                    if (es) {
                        "Reglas, mecánicas y filosofía de MathsMine3 — extraídas del README canónico."
                    } else {
                        "Rules, mechanics, and philosophy of MathsMine3 — from the canonical README."
                    },
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                )
            }
        }
        itemsIndexed(blocks, key = { i, b ->
            when (b) {
                is MdBlock.H -> "h-${b.id}-$i"
                else -> "b-$i"
            }
        }) { _, block ->
            when (block) {
                is MdBlock.H -> {
                    val color = when (block.level) {
                        1 -> Mm3Colors.Cyan
                        2 -> Color(0xFF94A3B8)
                        3 -> Mm3Colors.Magenta
                        else -> Mm3Colors.CyanDim
                    }
                    val size = when (block.level) {
                        1 -> 18.sp
                        2 -> 15.sp
                        3 -> 13.sp
                        else -> 12.sp
                    }
                    Column(Modifier.fillMaxWidth()) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            stripInlineMarkers(block.text),
                            color = color,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = size,
                            letterSpacing = if (block.level <= 2) 0.8.sp else 0.sp,
                        )
                        if (block.level == 2) {
                            Spacer(Modifier.height(2.dp))
                            Spacer(
                                Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(color.copy(alpha = 0.25f)),
                            )
                        }
                    }
                }
                is MdBlock.P -> InlineMdText(block.text, onAnchor = ::jumpToAnchor)
                is MdBlock.Li -> {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            if (block.ordered) "·" else "•",
                            color = Mm3Colors.Cyan,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                        )
                        InlineMdText(block.text, modifier = Modifier.weight(1f), onAnchor = ::jumpToAnchor)
                    }
                }
                is MdBlock.Code -> {
                    Text(
                        block.text.trimEnd(),
                        color = Mm3Colors.Green,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.2f), RoundedCornerShape(2.dp))
                            .background(Mm3Colors.BgDeep, RoundedCornerShape(2.dp))
                            .padding(8.dp),
                    )
                }
                is MdBlock.Quote -> {
                    Text(
                        stripInlineMarkers(block.text),
                        color = Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Mm3Colors.Magenta.copy(alpha = 0.25f), RoundedCornerShape(2.dp))
                            .padding(8.dp),
                    )
                }
                is MdBlock.Table -> {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.2f), RoundedCornerShape(2.dp))
                            .padding(6.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        block.rows.forEachIndexed { i, row ->
                            Text(
                                row.joinToString(" │ ") { stripInlineMarkers(it) },
                                color = if (i == 0) Mm3Colors.Cyan else Mm3Colors.Text,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = if (i == 0) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 9.sp,
                                maxLines = 2,
                            )
                        }
                    }
                }
                MdBlock.Hr -> {
                    Column {
                        Spacer(Modifier.height(6.dp))
                        Spacer(
                            Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(Mm3Colors.Muted.copy(alpha = 0.25f)),
                        )
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun InlineMdText(
    raw: String,
    modifier: Modifier = Modifier,
    onAnchor: (String) -> Unit = {},
) {
    val context = LocalContext.current
    val annotated = remember(raw) { annotateInline(raw) }
    ClickableText(
        text = annotated,
        modifier = modifier.padding(vertical = 2.dp),
        style = TextStyle(
            color = Mm3Colors.Text,
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            lineHeight = 17.sp,
        ),
        onClick = { offset ->
            annotated.getStringAnnotations("ANCHOR", offset, offset).firstOrNull()?.let { ann ->
                onAnchor(ann.item)
                return@ClickableText
            }
            annotated.getStringAnnotations("URL", offset, offset).firstOrNull()?.let { ann ->
                runCatching {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ann.item)))
                }
            }
        },
    )
}

private fun loadAsset(context: Context, name: String): String =
    context.assets.open(name).bufferedReader().use { it.readText() }

/** Strip accents — matches web ManifestoClient.slugify. */
private fun slugify(text: String): String {
    var t = text
        .replace(Regex("`([^`]+)`"), "$1")
        .replace(Regex("\\[([^\\]]+)\\]\\([^)]+\\)"), "$1")
        .lowercase()
    t = Normalizer.normalize(t, Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
    return t
        .replace(Regex("[^a-z0-9\\s-]"), "")
        .trim()
        .replace(Regex("\\s+"), "-")
}

/** Keep accents — matches GitHub-style anchors used in the Spanish index. */
private fun slugifyKeepAccents(text: String): String {
    val t = text
        .replace(Regex("`([^`]+)`"), "$1")
        .replace(Regex("\\[([^\\]]+)\\]\\([^)]+\\)"), "$1")
        .lowercase()
        .trim()
    return t
        .replace(Regex("[^\\p{L}\\p{N}\\s-]"), "")
        .replace(Regex("\\s+"), "-")
}

private fun parseMarkdown(src: String): List<MdBlock> {
    val lines = src.replace("\r\n", "\n").split('\n').filter { line ->
        val trimmed = line.trim()
        when {
            trimmed.isEmpty() -> true
            // Language section anchors left over from bilingual README extraction.
            trimmed.matches(Regex("""^<a\s+name=["'](?:english|español|espanol)["']\s*></a>$""", RegexOption.IGNORE_CASE)) -> false
            trimmed.matches(Regex("""^<a\s+name=["'][^"']+["']\s*></a>$""", RegexOption.IGNORE_CASE)) -> false
            // Other raw HTML leftovers.
            trimmed.startsWith("<") && trimmed.endsWith(">") && !trimmed.startsWith("```") -> false
            trimmed.matches(Regex("""^\*\*Live:\*\*.*""")) -> false
            trimmed.matches(Regex("""^\[!\[MathsMine3 Portal\]\([^)]+\)\]\([^)]+\)$""")) -> false
            else -> true
        }
    }
    val out = mutableListOf<MdBlock>()
    val usedSlugs = mutableMapOf<String, Int>()
    var i = 0
    while (i < lines.size) {
        val line = lines[i]
        val next = lines.getOrNull(i + 1).orEmpty()
        when {
            line.trim().matches(Regex("^---+\\s*$")) -> {
                out += MdBlock.Hr
                i++
            }
            line.startsWith("```") -> {
                val buf = StringBuilder()
                i++
                while (i < lines.size && !lines[i].startsWith("```")) {
                    buf.appendLine(lines[i])
                    i++
                }
                out += MdBlock.Code(buf.toString())
                i++ // skip closing fence
            }
            Regex("^#{1,4}\\s+").containsMatchIn(line) -> {
                val m = Regex("^(#{1,4})\\s+(.*)$").find(line)!!
                val text = m.groupValues[2].trim()
                val base = slugify(text).ifBlank { slugifyKeepAccents(text) }
                val n = usedSlugs[base] ?: 0
                usedSlugs[base] = n + 1
                val id = if (n == 0) base else "$base-$n"
                out += MdBlock.H(m.groupValues[1].length, text, id)
                i++
            }
            line.trimStart().startsWith("> ") || line.trim() == ">" -> {
                val buf = StringBuilder()
                while (i < lines.size && (lines[i].trimStart().startsWith(">") || lines[i].isBlank() && buf.isNotEmpty())) {
                    val t = lines[i].trimStart().removePrefix(">").trimStart()
                    if (t.isNotBlank()) {
                        if (buf.isNotEmpty()) buf.append(' ')
                        buf.append(t)
                    } else if (buf.isNotEmpty()) break
                    i++
                }
                out += MdBlock.Quote(buf.toString())
            }
            Regex("^[-*]\\s+").containsMatchIn(line) || Regex("^\\d+\\.\\s+").containsMatchIn(line) -> {
                val ordered = Regex("^\\d+\\.\\s+").containsMatchIn(line)
                val text = line.replace(Regex("^([-*]|\\d+\\.)\\s+"), "").trim()
                out += MdBlock.Li(ordered, text)
                i++
            }
            line.trim().startsWith("|") && isTableSep(next) -> {
                val rows = mutableListOf<List<String>>()
                while (i < lines.size && lines[i].trim().startsWith("|")) {
                    if (!isTableSep(lines[i])) rows += splitTableRow(lines[i])
                    i++
                }
                if (rows.isNotEmpty()) out += MdBlock.Table(rows)
            }
            line.isBlank() -> i++
            else -> {
                val buf = StringBuilder(line.trim())
                i++
                while (i < lines.size && lines[i].isNotBlank() && !isBlockStart(lines[i], lines.getOrNull(i + 1).orEmpty())) {
                    buf.append(' ').append(lines[i].trim())
                    i++
                }
                val text = buf.toString().trim()
                val imageOnly = text.startsWith("![") ||
                    text.startsWith("[![") ||
                    (text.startsWith("[") && text.contains("](") && text.contains("!["))
                if (!imageOnly && text.isNotBlank()) {
                    out += MdBlock.P(text)
                }
            }
        }
    }
    return out
}

private fun isTableSep(line: String): Boolean =
    Regex("^\\s*\\|?[\\s:\\-]+\\|[\\s|:\\-]*\\|?\\s*$").matches(line)

private fun splitTableRow(line: String): List<String> =
    line.trim()
        .removePrefix("|")
        .removeSuffix("|")
        .split('|')
        .map { it.trim() }

private fun isBlockStart(line: String, next: String): Boolean =
    Regex("^#{1,4}\\s+").containsMatchIn(line) ||
        line.trim().matches(Regex("^---+\\s*$")) ||
        line.startsWith("```") ||
        line.trimStart().startsWith(">") ||
        Regex("^[-*]\\s+").containsMatchIn(line) ||
        Regex("^\\d+\\.\\s+").containsMatchIn(line) ||
        (line.trim().startsWith("|") && isTableSep(next))

private fun stripInlineMarkers(text: String): String =
    text
        .replace(Regex("\\*\\*([^*]+)\\*\\*"), "$1")
        .replace(Regex("`([^`]+)`"), "$1")
        .replace(Regex("\\[([^\\]]+)\\]\\([^)]+\\)"), "$1")
        .replace(Regex("!\\[([^\\]]*)]\\([^)]+\\)"), "$1")

private fun annotateInline(text: String): AnnotatedString = buildAnnotatedString {
    var rest = text
    val linkRe = Regex("\\[([^\\]]+)\\]\\(([^)]+)\\)")
    val strongRe = Regex("\\*\\*([^*]+)\\*\\*")
    val codeRe = Regex("`([^`]+)`")
    val imageRe = Regex("!\\[([^\\]]*)]\\(([^)]+)\\)")

    while (rest.isNotEmpty()) {
        val link = linkRe.find(rest)
        val strong = strongRe.find(rest)
        val code = codeRe.find(rest)
        val image = imageRe.find(rest)
        val candidates = listOfNotNull(link, strong, code, image)
        val best = candidates.minByOrNull { it.range.first }
        if (best == null) {
            append(rest)
            break
        }
        if (best.range.first > 0) append(rest.substring(0, best.range.first))
        when (best) {
            link -> {
                val label = best.groupValues[1]
                val url = best.groupValues[2]
                val start = length
                withStyle(
                    SpanStyle(
                        color = Mm3Colors.Cyan,
                        textDecoration = TextDecoration.Underline,
                        fontWeight = FontWeight.Bold,
                    ),
                ) { append(label) }
                if (url.startsWith("#")) {
                    addStringAnnotation("ANCHOR", url.removePrefix("#"), start, length)
                } else {
                    addStringAnnotation("URL", url, start, length)
                }
            }
            strong -> withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = Mm3Colors.Text)) {
                append(best.groupValues[1])
            }
            code -> withStyle(SpanStyle(color = Mm3Colors.Green, fontFamily = FontFamily.Monospace)) {
                append(best.groupValues[1])
            }
            image -> append(best.groupValues[1].ifBlank { "[img]" })
        }
        rest = rest.substring(best.range.last + 1)
    }
}
