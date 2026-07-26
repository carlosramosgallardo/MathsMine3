package xyz.mathsmine3.nativeapp.ui

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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import xyz.mathsmine3.nativeapp.AppContainer
import xyz.mathsmine3.nativeapp.auth.AuthKind
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.ui.components.Mm3TopBar
import xyz.mathsmine3.nativeapp.ui.components.mm3PortalBackground
import xyz.mathsmine3.nativeapp.ui.screens.AuthScreen
import xyz.mathsmine3.nativeapp.ui.screens.DailyScreen
import xyz.mathsmine3.nativeapp.ui.screens.HomeScreen
import xyz.mathsmine3.nativeapp.ui.screens.MiningScreen
import xyz.mathsmine3.nativeapp.ui.screens.RankingScreen
import xyz.mathsmine3.nativeapp.ui.screens.RelayingScreen
import xyz.mathsmine3.nativeapp.ui.screens.SqueezingScreen
import xyz.mathsmine3.nativeapp.ui.screens.TradingScreen
import xyz.mathsmine3.nativeapp.ui.screens.TrainingScreen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

private data class Tab(val dest: Mm3Dest, val icon: String, val accent: Color)

private val tabs = listOf(
    Tab(Mm3Dest.Home, "⌂", Mm3Colors.Cyan),
    Tab(Mm3Dest.Mining, "⬡", Color(0xFFFB923C)),
    Tab(Mm3Dest.Training, "⛏", Color(0xFFF59E0B)),
    Tab(Mm3Dest.Trading, "💱", Mm3Colors.Green),
    Tab(Mm3Dest.Ranking, "🏆", Color(0xFFFBBF24)),
    Tab(Mm3Dest.Squeezing, "⚔", Mm3Colors.Danger),
    Tab(Mm3Dest.Relaying, ">_", Mm3Colors.Cyan),
    Tab(Mm3Dest.Daily, "🎯", Mm3Colors.Magenta),
)

@Composable
fun Mm3AppRoot(container: AppContainer) {
    val navController = rememberNavController()
    val session by container.sessionRepository.session.collectAsState(
        initial = Session(null, AuthKind.NONE)
    )
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    Scaffold(
        containerColor = Mm3Colors.Bg,
        topBar = {
            // Mining is full-bleed WebView FPV — hide portal chrome.
            if (currentRoute != Mm3Dest.Auth.route && currentRoute != Mm3Dest.Mining.route) {
                Column(Modifier.statusBarsPadding()) {
                    Mm3TopBar(
                        wallet = session.wallet,
                        onAuthClick = { navController.navigate(Mm3Dest.Auth.route) },
                    )
                }
            }
        },
        bottomBar = {
            if (currentRoute != Mm3Dest.Auth.route && currentRoute != Mm3Dest.Mining.route) {
                TerminalNavBar(
                    currentRoute = currentRoute,
                    onSelect = { route ->
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        },
    ) { padding ->
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
                        api = container.api,
                        onOpen = { route -> navController.navigate(route) },
                        onAuth = { navController.navigate(Mm3Dest.Auth.route) },
                    )
                }
                composable(Mm3Dest.Auth.route) {
                    AuthScreen(container = container, onDone = { navController.popBackStack() })
                }
                composable(Mm3Dest.Training.route) {
                    TrainingScreen(session = session, api = container.api)
                }
                composable(Mm3Dest.Mining.route) {
                    MiningScreen(
                        session = session,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(Mm3Dest.Trading.route) {
                    TradingScreen(session = session, api = container.api)
                }
                composable(Mm3Dest.Ranking.route) {
                    RankingScreen(api = container.api)
                }
                composable(Mm3Dest.Squeezing.route) {
                    SqueezingScreen(session = session, api = container.api)
                }
                composable(Mm3Dest.Relaying.route) {
                    RelayingScreen(
                        session = session,
                        api = container.api,
                        realtime = container.realtime,
                    )
                }
                composable(Mm3Dest.Daily.route) {
                    DailyScreen(session = session, api = container.api)
                }
            }
        }
    }
}

@Composable
private fun TerminalNavBar(currentRoute: String?, onSelect: (String) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .background(Mm3Colors.BgDeep)
            .border(width = 1.dp, color = Mm3Colors.Cyan.copy(alpha = 0.22f), shape = RoundedCornerShape(0))
            .padding(horizontal = 4.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        tabs.forEach { tab ->
            val selected = currentRoute == tab.dest.route
            Column(
                Modifier
                    .weight(1f)
                    .clickable { onSelect(tab.dest.route) }
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(tab.icon, fontSize = 14.sp, color = if (selected) tab.accent else Mm3Colors.Muted)
                Text(
                    tab.dest.label.take(4).uppercase(),
                    color = if (selected) tab.accent else Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                    fontSize = 8.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
