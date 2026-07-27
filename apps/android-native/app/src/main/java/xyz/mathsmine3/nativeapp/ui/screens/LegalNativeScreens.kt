package xyz.mathsmine3.nativeapp.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import xyz.mathsmine3.nativeapp.ui.components.Mm3Panel
import xyz.mathsmine3.nativeapp.ui.components.Mm3Screen
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

private data class LegalSection(
    val titleEn: String,
    val titleEs: String,
    val bodyEn: String,
    val bodyEs: String,
)

private data class ApiBlock(
    val titleEn: String,
    val titleEs: String,
    val descEn: String,
    val descEs: String,
    val endpoint: String,
    val sample: String,
)

@Composable
fun ApiNativeScreen(language: String = "en") {
    val es = language.startsWith("es", ignoreCase = true)
    val ctx = LocalContext.current
    val blocks = listOf(
        ApiBlock(
            "Token Value", "Valor del Token",
            "Latest aggregated MM3 value, updated every minute.",
            "Valor MM3 agregado más reciente, actualizado cada minuto.",
            "GET /api/token-value",
            """{
  "value": 1.0234,
  "updatedAt": "2025-03-23T20:00:00Z"
}""",
        ),
        ApiBlock(
            "Token History", "Histórico del Token",
            "Hourly MM3 value history with mined/trade/NFTJI breakdown.",
            "Histórico horario del valor MM3 con desglose mined/trade/NFTJI.",
            "GET /api/token-history",
            """[
  {
    "hour": "2025-03-26T18:00:00Z",
    "cumulative_reward": 0.00001776,
    "delta": 0.0000012
  }
]""",
        ),
        ApiBlock(
            "Minute-level History", "Histórico por Minutos",
            "Minute-by-minute MM3 value for the last 60 minutes.",
            "Valor MM3 minuto a minuto de los últimos 60 minutos.",
            "GET /api/token-history-minutes",
            """[
  {
    "minute": "14:30",
    "value": 0.00001234,
    "delta": 0.0000001
  }
]""",
        ),
        ApiBlock(
            "Market Events", "Eventos de Mercado",
            "NFTJI claims and life-continue events.",
            "Claims de NFTJI y eventos de vida continuada.",
            "GET /api/nft-events",
            """[
  {
    "wallet": "0xabc...1234",
    "event_type": "nftji_claim",
    "emoji": "🔮"
  }
]""",
        ),
        ApiBlock(
            "Leaderboard", "Leaderboard",
            "Full ranking sorted by MM3 Chain contribution.",
            "Ranking completo ordenado por contribución MM3 Chain.",
            "GET /api/leaderboard?page=1&limit=50",
            """{
  "page": 1,
  "limit": 50,
  "total": 128,
  "items": [{ "rank": 1, "wallet": "0xabc...1234" }]
}""",
        ),
        ApiBlock(
            "MM3 Block Chain", "MM3 Block Chain",
            "Mine a free board block from IRC when requirements are met.",
            "Mina un bloque libre del tablero desde IRC si cumples requisitos.",
            "POST /api/mine-block",
            """{
  "wallet": "0xabc123...",
  "blockHex": "#029"
}""",
        ),
        ApiBlock(
            "Squeezes", "Squeezes",
            "Dispute detail: pools, timings, wallets, scores, result and drop.",
            "Detalle de cada disputa: pools, tiempos, wallets, scores y drop.",
            "GET /api/wallet-pools/disputes?pool=FHNN6&limit=50",
            """{
  "ok": true,
  "disputes": [{ "id": 42, "status": "resolved", "winner": "defender" }]
}""",
        ),
        ApiBlock(
            "Service Status", "Estado del Servicio",
            "Service health and rate-limit quota.",
            "Estado de salud del servicio y cuota de rate limit.",
            "GET /api/status",
            """{
  "message": "✅ Within rate limit",
  "remaining": 9
}""",
        ),
    )

    Mm3Screen(
        title = "API",
        subtitle = if (es) {
            "endpoints publicos de MM3 y ejemplos JSON"
        } else {
            "public MM3 endpoints and JSON examples"
        },
    ) {
        Mm3Panel(accent = Mm3Colors.Cyan) {
            Text(
                if (es) {
                    "MathsMine3 ofrece una API publica con datos del mercado MM3 y del gameplay. Todos los endpoints devuelven JSON."
                } else {
                    "MathsMine3 provides a public API with MM3 market and gameplay data. All endpoints return JSON."
                },
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                lineHeight = 16.sp,
            )
        }
        blocks.forEach { block ->
            Mm3Panel(accent = Color(0xFF22D3EE)) {
                Text(
                    if (es) block.titleEs else block.titleEn,
                    color = Mm3Colors.Cyan,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
                Text(
                    if (es) block.descEs else block.descEn,
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                )
                Text(
                    block.endpoint,
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.25f), RoundedCornerShape(2.dp))
                        .background(Mm3Colors.BgDeep)
                        .clickable {
                            val path = block.endpoint.substringAfter(' ').substringBefore('?')
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://mathsmine3.xyz$path")))
                        }
                        .padding(10.dp),
                    color = Mm3Colors.Cyan,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
                Text(
                    block.sample,
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .border(1.dp, Mm3Colors.Cyan.copy(alpha = 0.15f), RoundedCornerShape(2.dp))
                        .background(Color(0xFF02060B))
                        .padding(10.dp),
                    color = Mm3Colors.Text,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                )
            }
        }
        Mm3Panel(accent = Color(0xFFFBBF24)) {
            Text(
                if (es) "RATE LIMITING" else "RATE LIMITING",
                color = Color(0xFFFBBF24),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
            )
            Text(
                if (es) {
                    "Los endpoints publicos (/api/token-value, /api/leaderboard) aplican un limite por IP. Las cabeceras X-RateLimit-* informan del estado de la cuota."
                } else {
                    "Public endpoints (/api/token-value, /api/leaderboard) enforce a per-IP limit. X-RateLimit-* headers report current quota."
                },
                color = Mm3Colors.Muted,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                lineHeight = 16.sp,
            )
        }
    }
}

@Composable
fun PrivacyNativeScreen(language: String = "en") {
    val es = language.startsWith("es", ignoreCase = true)
    val sections = listOf(
        LegalSection(
            "1. Data We Collect", "1. Datos que Recopilamos",
            "Wallet addresses, IRC messages, temporary IP rate-limit data, gameplay events, and optional Google identity for soft-wallet auth.",
            "Direcciones de wallet, mensajes IRC, datos temporales de IP para rate limit, eventos de juego e identidad opcional de Google para auth suave.",
        ),
        LegalSection(
            "2. How We Use Your Data", "2. Como Usamos tus Datos",
            "Exclusively to operate the game: leaderboards, token mining, market mechanics, and IRC communication.",
            "Exclusivamente para operar el juego: leaderboards, minado de tokens, mecanicas de mercado y comunicacion IRC.",
        ),
        LegalSection(
            "3. Third-Party Services", "3. Servicios de Terceros",
            "Supabase for database/realtime, Google Analytics and AdSense, and WalletConnect/Wagmi for wallet connectivity.",
            "Supabase para base de datos/realtime, Google Analytics y AdSense, y WalletConnect/Wagmi para conectividad de wallets.",
        ),
        LegalSection(
            "4. Cookies", "4. Cookies",
            "Cookies/localStorage are used for analytics, ads, and consent state. Consent can be withdrawn by clearing browser storage.",
            "Cookies/localStorage se usan para analitica, anuncios y el estado de consentimiento. Puedes retirarlo borrando el almacenamiento del navegador.",
        ),
        LegalSection(
            "5. Your Rights (GDPR / CCPA)", "5. Tus Derechos (GDPR / CCPA)",
            "You can request access, correction, or deletion of wallet-linked data via botsandpods@gmail.com.",
            "Puedes solicitar acceso, correccion o eliminacion de datos vinculados a tu wallet via botsandpods@gmail.com.",
        ),
        LegalSection(
            "6. Data Retention", "6. Retencion de Datos",
            "Gameplay and leaderboard history are retained indefinitely; rate-limit IP data is purged automatically.",
            "El historial de juego y leaderboard se conserva indefinidamente; los datos de IP para rate limit se purgan automaticamente.",
        ),
        LegalSection(
            "7. Children", "7. Menores",
            "MathsMine3 is not directed at children under 16. Crypto-related features require legal age.",
            "MathsMine3 no esta dirigido a menores de 16 anos. Las funciones cripto requieren mayoria de edad legal.",
        ),
        LegalSection(
            "8. Changes to This Policy", "8. Cambios en esta Politica",
            "Material changes will be announced in the Manifesto and reflected in the updated date.",
            "Los cambios relevantes se anunciaran en el Manifiesto y se reflejaran en la fecha de actualizacion.",
        ),
        LegalSection(
            "9. Security Audit Data", "9. Datos de la Auditoria de Seguridad",
            "Security scan results are stored in Supabase as an audit history. Probes are read-only and scoped to mathsmine3.xyz.",
            "Los resultados del scanner de seguridad se guardan en Supabase como historial de auditoria. Las sondas son de solo lectura y se limitan a mathsmine3.xyz.",
        ),
        LegalSection(
            "10. Contact", "10. Contacto",
            "Privacy inquiries: botsandpods@gmail.com",
            "Consultas de privacidad: botsandpods@gmail.com",
        ),
    )
    LegalScreen(
        title = if (es) "POLITICA DE PRIVACIDAD" else "PRIVACY POLICY",
        subtitle = if (es) "ultima actualizacion: abril 2026 · controller: FreakingAI" else "last updated: April 2026 · controller: FreakingAI",
        accent = Color(0xFF22D3EE),
        sections = sections,
        language = language,
    )
}

@Composable
fun TermsNativeScreen(language: String = "en") {
    val es = language.startsWith("es", ignoreCase = true)
    val sections = listOf(
        LegalSection("1. Acceptance", "1. Aceptacion", "By using MathsMine3, you agree to these Terms of Use.", "Al usar MathsMine3, aceptas estos Terminos de Uso."),
        LegalSection("2. Eligibility", "2. Requisitos", "You must be at least 18 or the legal age of majority in your jurisdiction.", "Debes tener al menos 18 anos o la mayoria de edad legal en tu jurisdiccion."),
        LegalSection("3. Permitted Use", "3. Uso Permitido", "No unfair automation, respect other players, secure your wallet, and comply with local law.", "No automatizacion injusta, respeta a otros jugadores, protege tu wallet y cumple la ley local."),
        LegalSection("4. Gameplay Outcomes", "4. Resultados de Juego", "Gameplay outcomes are permanent unless the game explicitly offers a recovery path.", "Los resultados del juego son permanentes salvo que el propio juego ofrezca una via de recuperacion."),
        LegalSection("5. Donations & No Refunds", "5. Donaciones y Sin Reembolsos", "Voluntary ETH donations are non-refundable and grant no exclusive rights.", "Las donaciones voluntarias en ETH son irrembolsables y no otorgan derechos exclusivos."),
        LegalSection("6. MM3 Token Disclaimer", "6. Aviso sobre el Token MM3", "MM3 is an in-game unit with no guaranteed real-world value and no financial advice is provided.", "MM3 es una unidad de juego sin valor real garantizado y no constituye asesoramiento financiero."),
        LegalSection("7. Public Data", "7. Datos Publicos", "Wallets, rankings, trade history, market ownership, and IRC messages are public by design.", "Wallets, rankings, historial de trade, propiedad de market y mensajes IRC son publicos por diseno."),
        LegalSection("8. Intellectual Property", "8. Propiedad Intelectual", "Source code is MIT/open-source; MathsMine3 name and visual identity remain FreakingAI property.", "El codigo es MIT/open-source; el nombre MathsMine3 y la identidad visual siguen siendo propiedad de FreakingAI."),
        LegalSection("9. Limitation of Liability", "9. Limitacion de Responsabilidad", "The platform is provided as is, with no warranty. Use at your own risk.", "La plataforma se ofrece tal cual, sin garantia. Usala bajo tu propio riesgo."),
        LegalSection("10. Termination", "10. Terminacion", "We may restrict abusive, automated, or disruptive users without prior notice.", "Podemos restringir usuarios abusivos, automatizados o disruptivos sin previo aviso."),
        LegalSection("11. Governing Law", "11. Ley Aplicable", "These terms are governed by Spanish law, subject to mandatory EU consumer protections.", "Estos terminos se rigen por la ley espanola, sin perjuicio de la proteccion obligatoria al consumidor en la UE."),
        LegalSection("12. Security Audit Tool", "12. Herramienta de Auditoria de Seguridad", "The security scanner targets only mathsmine3.xyz and its public codebase using read-only checks.", "El escaner de seguridad solo apunta a mathsmine3.xyz y su codigo publico mediante comprobaciones de solo lectura."),
        LegalSection("13. Contact", "13. Contacto", "Questions about these terms: botsandpods@gmail.com", "Consultas sobre estos terminos: botsandpods@gmail.com"),
    )
    LegalScreen(
        title = if (es) "TERMINOS DE USO" else "TERMS OF USE",
        subtitle = if (es) "ultima actualizacion: abril 2026 · MathsMine3 / FreakingAI" else "last updated: April 2026 · MathsMine3 / FreakingAI",
        accent = Color(0xFFA78BFA),
        sections = sections,
        language = language,
    )
}

@Composable
private fun LegalScreen(
    title: String,
    subtitle: String,
    accent: Color,
    sections: List<LegalSection>,
    language: String,
) {
    val es = language.startsWith("es", ignoreCase = true)
    Mm3Screen(
        title = title,
        subtitle = subtitle,
    ) {
        sections.forEach { section ->
            Mm3Panel(accent = accent) {
                Text(
                    if (es) section.titleEs else section.titleEn,
                    color = accent,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                )
                Text(
                    if (es) section.bodyEs else section.bodyEn,
                    color = Mm3Colors.Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                )
            }
        }
        Mm3Panel(accent = Mm3Colors.Muted) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("botsandpods@gmail.com", "mathsmine3.xyz").forEach { item ->
                    Text(
                        item,
                        modifier = Modifier
                            .border(1.dp, Mm3Colors.Muted.copy(alpha = 0.25f), RoundedCornerShape(2.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        color = Mm3Colors.Muted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
            }
        }
    }
}
