package xyz.mathsmine3.nativeapp

import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import xyz.mathsmine3.nativeapp.BuildConfig

object PortalWebViewSecurity {
    fun isAllowedUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        if (PortalOfflinePage.isOfflineContent(url)) return true
        return try {
            val uri = Uri.parse(url)
            val host = uri.host?.lowercase().orEmpty()
            if (host.isEmpty()) return false
            when {
                PortalOrigin.isPortalHost(host) -> true
                BuildConfig.DEBUG && PortalOrigin.isLocalHost(host) -> true
                else -> false
            }
        } catch (_: Exception) {
            false
        }
    }

    fun shouldBlockNavigation(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString()
        if (url.isNullOrBlank()) return false
        if (request?.isForMainFrame != true) return !isAllowedUrl(url)
        return !isAllowedUrl(url)
    }
}
