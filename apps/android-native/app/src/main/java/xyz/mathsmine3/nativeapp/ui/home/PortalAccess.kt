package xyz.mathsmine3.nativeapp.ui.home

import androidx.compose.ui.graphics.Color
import xyz.mathsmine3.nativeapp.ui.Mm3Dest
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

data class PortalAccess(
    val route: String,
    val icon: String,
    val name: String,
    val desc: String,
    val accent: Color,
    val daily: Boolean = false,
    val sectionNftjis: List<String> = emptyList(),
)

/** Same order/copy as LandingHero PORTAL.es (mobile vertical home). */
val PortalAccessesEs = listOf(
    PortalAccess(Mm3Dest.Mining.route, "⬡", "Mining", "El mundo 3D. 1000 bloques minables.", Color(0xFFFB923C)),
    PortalAccess(Mm3Dest.Training.route, "⛏", "Training", "Matemáticas bajo presión.", Color(0xFFF59E0B), sectionNftjis = listOf("❤️", "🔮", "🍀", "🎰", "🧿")),
    PortalAccess(Mm3Dest.Trading.route, "💱", "Trading", "Compra y vende MM3. 5 EXECs/día.", Mm3Colors.Green, sectionNftjis = listOf("👾")),
    PortalAccess(Mm3Dest.Squeezing.route, "⚔", "Squeezing", "Combate pool-vs-pool. Quema stakes, gana NFTJIs.", Mm3Colors.Danger, sectionNftjis = listOf("🔰", "⚔️")),
    PortalAccess(Mm3Dest.Relaying.route, ">_", "Relaying", "Terminal de acción. /mine, eventos, log.", Mm3Colors.Cyan, sectionNftjis = listOf("🔁")),
    PortalAccess(Mm3Dest.Daily.route, "🎯", "Daily Tasks", "Objetivos diarios → EUR ficticio.", Mm3Colors.Magenta, daily = true),
    PortalAccess("mm3-value", "📈", "MM3 Chart", "Valor del token en el tiempo — gráfica horaria.", Color(0xFFA78BFA)),
    PortalAccess(Mm3Dest.Ranking.route, "🏆", "Ranking", "Clasificación en vivo. Ranks de wallets y pools.", Color(0xFFFBBF24)),
    PortalAccess("ai-team", "🤖", "AI Team", "Bots 24/7 minando junto a humanos.", Color(0xFF86EFAC)),
    PortalAccess("manifesto", "📜", "Manifiesto", "Guía completa — reglas, mecánicas, filosofía.", Color(0xFF94A3B8)),
)
