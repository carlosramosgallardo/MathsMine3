package xyz.mathsmine3.nativeapp.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import java.math.BigDecimal
import java.math.BigInteger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import xyz.mathsmine3.nativeapp.AppContainer
import xyz.mathsmine3.nativeapp.BuildConfig
import xyz.mathsmine3.nativeapp.auth.AuthKind
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.data.jsonBody
import xyz.mathsmine3.nativeapp.ui.components.PortalHeaderBar
import xyz.mathsmine3.nativeapp.ui.components.mm3PortalBackground
import xyz.mathsmine3.nativeapp.ui.screens.AiTeamScreen
import xyz.mathsmine3.nativeapp.ui.screens.ApiNativeScreen
import xyz.mathsmine3.nativeapp.ui.screens.AuthScreen
import xyz.mathsmine3.nativeapp.ui.screens.DailyScreen
import xyz.mathsmine3.nativeapp.ui.screens.HomeScreen
import xyz.mathsmine3.nativeapp.ui.screens.Mm3ValueScreen
import xyz.mathsmine3.nativeapp.ui.screens.ManifestoScreen
import xyz.mathsmine3.nativeapp.ui.screens.MiningScreen
import xyz.mathsmine3.nativeapp.ui.screens.PrivacyNativeScreen
import xyz.mathsmine3.nativeapp.ui.screens.RankingScreen
import xyz.mathsmine3.nativeapp.ui.screens.RelayingScreen
import xyz.mathsmine3.nativeapp.ui.screens.SecurityAuditScreen
import xyz.mathsmine3.nativeapp.ui.screens.SqueezingScreen
import xyz.mathsmine3.nativeapp.ui.screens.TermsNativeScreen
import xyz.mathsmine3.nativeapp.ui.screens.TradingScreen
import xyz.mathsmine3.nativeapp.ui.screens.TrainingScreen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

/** Bottom bar = Home + portal footer (game sections live on the nonagon). */
private data class FooterTab(
    val route: String,
    val label: String,
    val accent: Color,
    val portalUrl: String? = null,
    val externalUrl: String? = null,
    val ethDonate: Boolean = false,
)

/** Mirrors portal Footer.jsx socials + docs + support (2 centered rows on native).
 *  Home lives on the always-visible header minilogo — not duplicated here. */
private val footerRowSocial = listOf(
    FooterTab("yt", "YT", Color(0xFFF87171), externalUrl = "https://www.youtube.com/@FreakingAI"),
    FooterTab("tt", "TT", Color(0xFF67E8F9), externalUrl = "https://www.tiktok.com/@freakingai"),
    FooterTab("ig", "IG", Color(0xFFF472B6), externalUrl = "https://www.instagram.com/freakingai"),
    FooterTab("x", "X", Color(0xFFE2E8F0), externalUrl = "https://x.com/freakingai"),
    FooterTab("gh", "GH", Color(0xFFE2E8F0), externalUrl = "https://github.com/carlosramosgallardo/MathsMine3"),
)

private val footerRowDocs = listOf(
    FooterTab(Mm3Dest.Api.route, "API", Color(0xFF67E8F9), portalUrl = "https://mathsmine3.xyz/api"),
    FooterTab(Mm3Dest.Security.route, "SEC", Color(0xFFFBBF24), portalUrl = "https://mathsmine3.xyz/security"),
    FooterTab(Mm3Dest.Privacy.route, "Privacy", Color(0xFFA78BFA), portalUrl = "https://mathsmine3.xyz/privacy"),
    FooterTab(Mm3Dest.Terms.route, "Terms", Color(0xFF94A3B8), portalUrl = "https://mathsmine3.xyz/terms"),
    // Mirrors web Footer SUPPORT_LINKS: ETH · BMC · PAT
    FooterTab("eth", "ETH", Color(0xFF22D3EE), ethDonate = true),
    FooterTab("bmc", "BMC", Color(0xFFFBBF24), externalUrl = "https://buymeacoffee.com/freakingai"),
    FooterTab("pat", "PAT", Color(0xFFF87171), externalUrl = "https://patreon.com/FreakingAI"),
)

@Composable
fun Mm3AppRoot(container: AppContainer) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val session by container.sessionRepository.session.collectAsState(
        initial = Session(null, AuthKind.NONE)
    )
    val uiPrefs by container.uiPrefsRepository.prefs.collectAsState(
        initial = UiPrefs(language = UiPrefsRepository.defaultLang())
    )
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    var showEthDonate by remember { mutableStateOf(false) }

    LaunchedEffect(uiPrefs.soundEnabled, uiPrefs.musicEnabled) {
        SoundPrefsBridge.update(uiPrefs.soundEnabled, uiPrefs.musicEnabled)
    }

    fun go(route: String) {
        if (route == Mm3Dest.Home.route) {
            // Always land on Home and clear section stack (Training/Mining/…).
            navController.navigate(Mm3Dest.Home.route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    inclusive = false
                    saveState = false
                }
                launchSingleTop = true
                restoreState = false
            }
            return
        }
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        containerColor = Mm3Colors.Bg,
        topBar = {
            if (currentRoute != Mm3Dest.Auth.route) {
                Column(Modifier.statusBarsPadding()) {
                    PortalHeaderBar(
                        session = session,
                        language = uiPrefs.language,
                        currency = uiPrefs.currency,
                        soundEnabled = uiPrefs.soundEnabled,
                        musicEnabled = uiPrefs.musicEnabled,
                        api = container.api,
                        supabase = container.supabase,
                        onNativeRoute = { go(it) },
                        onAuth = { navController.navigate(Mm3Dest.Auth.route) },
                        onDisconnect = {
                            scope.launch {
                                if (session.hasApiSession) {
                                    runCatching {
                                        withContext(Dispatchers.IO) {
                                            container.api.presencePing(
                                                jsonBody {
                                                    put(
                                                        "source",
                                                        if (session.kind == AuthKind.GOOGLE) "google" else "wallet",
                                                    )
                                                    put("disconnect", true)
                                                },
                                            )
                                        }
                                    }
                                }
                                container.sessionRepository.clear()
                            }
                        },
                        onLanguage = { lang ->
                            scope.launch { container.uiPrefsRepository.setLanguage(lang) }
                        },
                        onCurrency = { cur ->
                            scope.launch { container.uiPrefsRepository.setCurrency(cur) }
                        },
                        onSound = { enabled ->
                            scope.launch { container.uiPrefsRepository.setSoundEnabled(enabled) }
                        },
                        onMusic = { enabled ->
                            scope.launch { container.uiPrefsRepository.setMusicEnabled(enabled) }
                        },
                    )
                }
            }
        },
        bottomBar = {
            if (currentRoute != Mm3Dest.Auth.route && currentRoute != Mm3Dest.Mining.route) {
                FooterNavBar(
                    currentRoute = currentRoute,
                    onSelect = { tab ->
                        when {
                            tab.ethDonate -> showEthDonate = true
                            tab.externalUrl != null -> {
                                runCatching {
                                    context.startActivity(
                                        Intent(Intent.ACTION_VIEW, Uri.parse(tab.externalUrl)),
                                    )
                                }
                            }
                            tab.portalUrl != null -> go(tab.route)
                            else -> go(tab.route)
                        }
                    },
                )
            }
        },
    ) { padding ->
        if (showEthDonate) {
            EthDonateDialog(
                language = uiPrefs.language,
                session = session,
                onDismiss = { showEthDonate = false },
            )
        }
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .mm3PortalBackground(),
        ) {
            NavHost(
                navController = navController,
                startDestination = Mm3Dest.Home.route,
                modifier = Modifier.fillMaxSize(),
            ) {
                composable(Mm3Dest.Home.route) {
                    HomeScreen(
                        session = session,
                        language = uiPrefs.language,
                        api = container.api,
                        onOpen = { route -> go(route) },
                        onAuth = { navController.navigate(Mm3Dest.Auth.route) },
                    )
                }
                composable(Mm3Dest.Auth.route) {
                    AuthScreen(container = container, onDone = { navController.popBackStack() })
                }
                composable(Mm3Dest.Training.route) {
                    TrainingScreen(
                        session = session,
                        api = container.api,
                        supabase = container.supabase,
                    )
                }
                composable(Mm3Dest.Mining.route) {
                    MiningScreen(
                        session = session,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(Mm3Dest.Trading.route) {
                    TradingScreen(
                        session = session,
                        api = container.api,
                        supabase = container.supabase,
                        currency = uiPrefs.currency,
                    )
                }
                composable(Mm3Dest.Ranking.route) {
                    RankingScreen(
                        session = session,
                        api = container.api,
                        currency = uiPrefs.currency,
                        language = uiPrefs.language,
                    )
                }
                composable(Mm3Dest.Squeezing.route) {
                    SqueezingScreen(
                        session = session,
                        api = container.api,
                        language = uiPrefs.language,
                        currency = uiPrefs.currency,
                        onNativeRoute = { go(it) },
                    )
                }
                composable(Mm3Dest.Relaying.route) {
                    RelayingScreen(
                        session = session,
                        api = container.api,
                        supabase = container.supabase,
                        realtime = container.realtime,
                        language = uiPrefs.language,
                    )
                }
                composable(Mm3Dest.Daily.route) {
                    DailyScreen(
                        session = session,
                        api = container.api,
                        supabase = container.supabase,
                        currency = uiPrefs.currency,
                        language = uiPrefs.language,
                    )
                }
                composable(Mm3Dest.Mm3Value.route) {
                    Mm3ValueScreen(
                        api = container.api,
                        language = uiPrefs.language,
                    )
                }
                composable(Mm3Dest.AiTeam.route) {
                    AiTeamScreen(
                        api = container.api,
                        language = uiPrefs.language,
                        onOpenRanking = { go(Mm3Dest.Ranking.route) },
                    )
                }
                composable(Mm3Dest.Manifesto.route) {
                    ManifestoScreen(language = uiPrefs.language)
                }
                composable(Mm3Dest.Api.route) {
                    ApiNativeScreen(language = uiPrefs.language)
                }
                composable(Mm3Dest.Security.route) {
                    SecurityAuditScreen(api = container.api, language = uiPrefs.language)
                }
                composable(Mm3Dest.Privacy.route) {
                    PrivacyNativeScreen(language = uiPrefs.language)
                }
                composable(Mm3Dest.Terms.route) {
                    TermsNativeScreen(language = uiPrefs.language)
                }
            }
        }
    }
}

@Composable
private fun FooterNavBar(
    currentRoute: String?,
    onSelect: (FooterTab) -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .background(Mm3Colors.BgDeep)
            .border(width = 1.dp, color = Mm3Colors.Cyan.copy(alpha = 0.22f), shape = RoundedCornerShape(0))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        FooterTabRow(tabs = footerRowSocial, currentRoute = currentRoute, onSelect = onSelect)
        FooterTabRow(tabs = footerRowDocs, currentRoute = currentRoute, onSelect = onSelect)
        Text(
            "© 2026 FreakingAI",
            color = Mm3Colors.Muted.copy(alpha = 0.7f),
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun FooterTabRow(
    tabs: List<FooterTab>,
    currentRoute: String?,
    onSelect: (FooterTab) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEach { tab ->
            val selected = currentRoute == tab.route
            Text(
                tab.label,
                modifier = Modifier
                    .clickable { onSelect(tab) }
                    .padding(horizontal = 7.dp, vertical = 3.dp),
                color = if (selected || tab.ethDonate) tab.accent else Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontWeight = if (selected || tab.ethDonate) FontWeight.Bold else FontWeight.Normal,
                fontSize = 10.sp,
                maxLines = 1,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun EthDonateDialog(
    language: String,
    session: Session,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val es = language.startsWith("es", ignoreCase = true)
    val amount = BuildConfig.DONATE_ETH_AMOUNT.ifBlank { "0.00001" }
    val admin = BuildConfig.ADMIN_WALLET.trim()
    val amountFmt = runCatching {
        BigDecimal(amount).setScale(6, java.math.RoundingMode.HALF_UP).toPlainString()
    }.getOrDefault(amount)

    val title = if (es) "Donar ETH" else "Donate ETH"
    val body = when {
        admin.isBlank() -> if (es) {
            "Wallet de donación no configurada."
        } else {
            "Donation wallet is not configured."
        }
        session.kind == AuthKind.GOOGLE -> if (es) {
            "La donación on-chain requiere una wallet real (MetaMask). Envía $amountFmt ETH a:\n$admin"
        } else {
            "On-chain donation requires a real wallet (MetaMask). Send $amountFmt ETH to:\n$admin"
        }
        else -> if (es) {
            "Apoya a FreakingAI · Envía $amountFmt ETH on-chain para alimentar MM3.\n$admin"
        } else {
            "Support FreakingAI · Send $amountFmt ETH on-chain to power MM3.\n$admin"
        }
    }

    fun copyAddress() {
        if (admin.isBlank()) return
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("MM3 donate", admin))
        Toast.makeText(
            context,
            if (es) "Dirección copiada" else "Address copied",
            Toast.LENGTH_SHORT,
        ).show()
    }

    fun openMetaMask() {
        if (admin.isBlank()) return
        val weiHex = ethAmountToWeiHex(amount)
        val uri = Uri.parse("https://metamask.app.link/send/$admin@1?value=$weiHex")
        val ok = runCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        }.getOrDefault(false)
        if (!ok) {
            Toast.makeText(
                context,
                if (es) "No se pudo abrir MetaMask" else "Could not open MetaMask",
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Mm3Colors.BgDeep,
        titleContentColor = Mm3Colors.Cyan,
        textContentColor = Mm3Colors.Muted,
        title = {
            Text(title, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
        },
        text = {
            Text(body, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        },
        confirmButton = {
            TextButton(onClick = { openMetaMask(); onDismiss() }, enabled = admin.isNotBlank()) {
                Text("MetaMask", color = Mm3Colors.Cyan, fontFamily = FontFamily.Monospace)
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = { copyAddress() }, enabled = admin.isNotBlank()) {
                    Text(
                        if (es) "Copiar" else "Copy",
                        color = Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                TextButton(onClick = onDismiss) {
                    Text(
                        if (es) "Cerrar" else "Close",
                        color = Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        },
    )
}

/** Wei as hex without 0x — MetaMask mobile send deeplink format. */
private fun ethAmountToWeiHex(amountEth: String): String {
    val eth = runCatching { BigDecimal(amountEth.trim()) }.getOrElse { BigDecimal("0.00001") }
    val wei: BigInteger = eth.multiply(BigDecimal.TEN.pow(18)).toBigInteger()
    return wei.toString(16)
}
