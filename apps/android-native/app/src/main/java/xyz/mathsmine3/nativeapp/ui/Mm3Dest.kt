package xyz.mathsmine3.nativeapp.ui

enum class Mm3Dest(val route: String, val label: String) {
    Home("home", "Home"),
    Training("training", "Training"),
    Mining("mining", "Mining"),
    Trading("trading", "Trading"),
    Ranking("ranking", "Ranking"),
    Squeezing("squeezing", "Squeezing"),
    Relaying("relaying", "Relaying"),
    Daily("daily", "Daily"),
    Mm3Value("mm3-value", "MM3 Chart"),
    AiTeam("ai-team", "AI Team"),
    Manifesto("manifesto", "Manifesto"),
    Auth("auth", "Auth"),
    // Portal footer docs (bottom nav) — not on the home nonagon.
    Api("api", "API"),
    Security("security", "SEC"),
    Privacy("privacy", "Privacy"),
    Terms("terms", "Terms"),
}
