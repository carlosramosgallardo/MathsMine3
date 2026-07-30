package xyz.mathsmine3.nativeapp.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.delay
import xyz.mathsmine3.nativeapp.R
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.Mm3Api
import xyz.mathsmine3.nativeapp.ui.home.HomeArenaWebView
import xyz.mathsmine3.nativeapp.ui.home.HomeMinimapWebView
import xyz.mathsmine3.nativeapp.ui.home.PortalAccess
import xyz.mathsmine3.nativeapp.ui.home.portalAccessesFor
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

@Composable
@Suppress("UNUSED_PARAMETER")
fun HomeScreen(
    session: Session,
    language: String = "en",
    api: Mm3Api,
    onOpen: (String) -> Unit,
    onAuth: () -> Unit,
) {
    val portal = portalAccessesFor(language)
    var sel by remember { mutableIntStateOf(0) }
    var lastManualMs by remember { mutableStateOf(0L) }
    var mapOpen by remember { mutableStateOf(false) }
    var arenaWeb by remember { mutableStateOf<HomeArenaWebView?>(null) }

    // Keep selection valid when language swap rebuilds the portal list.
    LaunchedEffect(portal.size) {
        if (sel >= portal.size) sel = 0
    }

    BackHandler(enabled = mapOpen) { mapOpen = false }

    LaunchedEffect(portal.size, mapOpen, arenaWeb) {
        while (true) {
            delay(3000)
            if (mapOpen) continue
            if (System.currentTimeMillis() - lastManualMs >= 5000) {
                sel = (sel + 1) % portal.size
                // Same as web: carousel glides one slot only on auto-rotation.
                arenaWeb?.cycleWithNonagon()
            }
        }
    }

    val current = portal[sel]

    fun openAccess(access: PortalAccess) {
        when (access.route) {
            in setOf(
                "training", "mining", "trading", "ranking", "squeezing",
                "relaying", "daily", "mm3-value", "ai-team", "manifesto",
            ) -> onOpen(access.route)
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Mm3Colors.BgDeep)
            .drawBehind {
                val step = 32.dp.toPx()
                val grid = Color(0x0D7DD3FC)
                var x = 0f
                while (x < size.width) {
                    drawLine(grid, Offset(x, 0f), Offset(x, size.height), 1f)
                    x += step
                }
                var y = 0f
                while (y < size.height) {
                    drawLine(grid, Offset(0f, y), Offset(size.width, y), 1f)
                    y += step
                }
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0x3322D3EE), Color.Transparent),
                        center = Offset(size.width / 2f, size.height * 0.1f),
                        radius = size.minDimension * 0.5f,
                    ),
                    radius = size.minDimension * 0.5f,
                    center = Offset(size.width / 2f, size.height * 0.1f),
                )
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            var y = 0f
            val step = 4.dp.toPx()
            while (y < size.height) {
                drawLine(Color(0x0A000000), Offset(0f, y), Offset(size.width, y), 1f)
                y += step
            }
        }

        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(if (mapOpen) 96.dp else 120.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.35f), RoundedCornerShape(4.dp))
                    .background(Mm3Colors.BgDeep),
            ) {
                AndroidView(
                    factory = { ctx ->
                        HomeArenaWebView(ctx).also {
                            it.setSessionWallet(session.wallet)
                            it.loadArena()
                            arenaWeb = it
                        }
                    },
                    update = {
                        it.setSessionWallet(session.wallet)
                        val wallet = session.wallet?.lowercase()
                        val currentUrl = it.url?.lowercase().orEmpty()
                        if (wallet != null && !currentUrl.contains("mm3_gw=$wallet")) {
                            it.loadArena()
                        }
                    },
                    modifier = Modifier.fillMaxSize(),
                    onRelease = {
                        it.destroy()
                        arenaWeb = null
                    },
                )
            }

            Spacer(Modifier.height(4.dp))

            if (mapOpen) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clip(RoundedCornerShape(4.dp))
                        .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.35f), RoundedCornerShape(4.dp))
                        .background(Mm3Colors.BgDeep),
                ) {
                    AndroidView(
                        factory = { ctx ->
                            HomeMinimapWebView(ctx).apply {
                                setLanguage(language)
                                onClose = { mapOpen = false }
                                loadMinimap()
                            }
                        },
                        update = { view ->
                            view.setLanguage(language)
                            view.onClose = { mapOpen = false }
                        },
                        modifier = Modifier.fillMaxSize(),
                        onRelease = { view ->
                            view.onClose = null
                            view.stopLoading()
                            view.destroy()
                        },
                    )
                }
            } else {
                NonagonRing(
                    portal = portal,
                    selected = sel,
                    onSelect = { i ->
                        lastManualMs = System.currentTimeMillis()
                        if (i == sel) openAccess(portal[i]) else sel = i
                    },
                    onLogoClick = { mapOpen = true },
                    onPrev = {
                        lastManualMs = System.currentTimeMillis()
                        sel = (sel - 1 + portal.size) % portal.size
                    },
                    onNext = {
                        lastManualMs = System.currentTimeMillis()
                        sel = (sel + 1) % portal.size
                    },
                )

                Spacer(Modifier.height(4.dp))

                CaptionCard(access = current, onOpen = { openAccess(current) })
            }

            @Suppress("UNUSED_VARIABLE")
            val _api = api
            @Suppress("UNUSED_PARAMETER")
            val _auth = onAuth
        }
    }
}

@Composable
private fun CaptionCard(access: PortalAccess, onOpen: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth(0.94f)
            .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.55f), RoundedCornerShape(2.dp))
            .background(
                Brush.linearGradient(listOf(Color(0x240E7490), Color(0xD901070E))),
                RoundedCornerShape(2.dp),
            )
            .clickable(onClick = onOpen)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(access.icon, fontSize = 14.sp)
            Text(
                access.name.uppercase(),
                color = Mm3Colors.Cyan,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp,
                letterSpacing = 1.5.sp,
            )
        }
        Text(
            access.desc,
            color = Color(0xFF94A3B8),
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            textAlign = TextAlign.Center,
            lineHeight = 13.sp,
            maxLines = 2,
        )
        if (access.sectionNftjis.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                access.sectionNftjis.forEach { emoji ->
                    Box(
                        Modifier
                            .size(20.dp)
                            .border(1.dp, Color(0xFFFBBF24), RoundedCornerShape(2.dp))
                            .background(Color(0xEB01070E), RoundedCornerShape(2.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(emoji, fontSize = 9.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun NonagonRing(
    portal: List<PortalAccess>,
    selected: Int,
    onSelect: (Int) -> Unit,
    onLogoClick: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
) {
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0.85f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "p",
    )

    Row(
        Modifier
            .fillMaxWidth()
            .height(208.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        ArrowBtn("‹", onPrev)
        BoxWithConstraints(
            Modifier
                .weight(1f)
                .fillMaxSize()
                .padding(horizontal = 2.dp),
            contentAlignment = Alignment.Center,
        ) {
            // Radius uses min side so the ring grows with height; logo is a true square circle.
            val polyFrac = 0.47f
            val side = minOf(maxWidth, maxHeight)
            val logoDp = side * 0.70f
            Canvas(
                Modifier
                    .fillMaxSize()
                    .pointerInput(portal.size, selected) {
                        detectTapGestures { offset ->
                            val n = portal.size
                            val cx = size.width / 2f
                            val cy = size.height / 2f
                            val dx = offset.x - cx
                            val dy = offset.y - cy
                            val dist = hypot(dx.toDouble(), dy.toDouble())
                            val r = min(size.width, size.height) * polyFrac
                            if (dist < r * 0.45) {
                                onLogoClick()
                                return@detectTapGestures
                            }
                            var ang = Math.toDegrees(atan2(dy.toDouble(), dx.toDouble()))
                            ang = (ang + 90 + 360) % 360
                            val sideIdx = ((ang / (360.0 / n)) % n).toInt()
                            onSelect(sideIdx)
                        }
                    },
            ) {
                val n = portal.size
                val cx = size.width / 2f
                val cy = size.height / 2f
                val r = min(size.width, size.height) * polyFrac
                fun pt(i: Int): Offset {
                    val a = Math.toRadians((-90.0 + i * (360.0 / n)))
                    return Offset(cx + (r * cos(a)).toFloat(), cy + (r * sin(a)).toFloat())
                }
                for (i in 0 until n) {
                    val selectedSide = i == selected
                    val stroke = if (selectedSide) Color(0xFFFF2020) else Mm3Colors.Cyan
                    drawLine(
                        color = stroke.copy(alpha = if (selectedSide) 1f else 0.62f * pulse),
                        start = pt(i),
                        end = pt(i + 1),
                        strokeWidth = if (selectedSide) 9f else 5.5f,
                        cap = StrokeCap.Round,
                    )
                }
            }

            Box(
                Modifier
                    .size(logoDp)
                    .clip(CircleShape)
                    .clickable(onClick = onLogoClick),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(R.drawable.mm3_logo_core),
                    contentDescription = "MM3",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .size(logoDp)
                        .padding(2.dp),
                )
            }
        }
        ArrowBtn("›", onNext)
    }
}

@Composable
private fun ArrowBtn(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(28.dp)
            .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.4f), RoundedCornerShape(2.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Mm3Colors.Cyan, fontSize = 18.sp, fontFamily = FontFamily.Monospace)
    }
}
