package xyz.mathsmine3.nativeapp

/**
 * Portal origin for WebViews.
 * Debug → local Next (`adb reverse tcp:3000 tcp:3000`).
 * Release → production.
 */
object PortalOrigin {
    val base: String
        get() = BuildConfig.PORTAL_BASE_URL.trimEnd('/')

    fun url(path: String): String {
        val p = if (path.startsWith("/")) path else "/$path"
        return base + p
    }

    fun isLocalHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        val h = host.lowercase()
        return h == "127.0.0.1" || h == "localhost" || h == "10.0.2.2" || h.endsWith(".local")
    }

    fun isPortalHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        val h = host.lowercase()
        return h.contains("mathsmine3") || isLocalHost(h)
    }
}
