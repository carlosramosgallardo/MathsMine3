package xyz.mathsmine3.nativeapp

import android.net.Uri
import android.webkit.SslErrorHandler
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError

/**
 * Debug-only: allow the local Next experimental-https cert on loopback
 * (127.0.0.1 / localhost / 10.0.2.2) so WebViews can hit the WSL/host portal.
 */
fun WebViewClient.handleLocalPortalSsl(
    view: WebView?,
    handler: SslErrorHandler?,
    error: SslError?,
): Boolean {
    if (!BuildConfig.DEBUG) return false
    val host = try {
        Uri.parse(error?.url ?: view?.url).host
    } catch (_: Exception) {
        null
    }
    if (!PortalOrigin.isLocalHost(host)) return false
    handler?.proceed()
    return true
}
