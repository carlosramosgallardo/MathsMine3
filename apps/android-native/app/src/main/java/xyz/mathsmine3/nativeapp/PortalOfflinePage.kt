package xyz.mathsmine3.nativeapp

import android.util.Log
import android.webkit.WebView
import java.nio.charset.StandardCharsets

/**
 * Last-resort packed HTML when a portal WebView cannot reach the live site.
 * Loaded via loadDataWithBaseURL so [WebSettings.allowFileAccess] stays false.
 */
object PortalOfflinePage {
    const val ASSET_PATH = "webview/offline.html"
    const val HISTORY_PATH = "/__native_offline"

    fun isOfflineContent(url: String?): Boolean {
        val value = url.orEmpty()
        return value.contains(HISTORY_PATH) || value.startsWith("data:text/html")
    }

    fun loadInto(view: WebView) {
        val origin = PortalOrigin.base
        val html = try {
            view.context.assets.open(ASSET_PATH).use { stream ->
                stream.readBytes().toString(StandardCharsets.UTF_8)
            }
        } catch (error: Exception) {
            Log.e(TAG, "missing $ASSET_PATH", error)
            MISSING_ASSET_HTML
        }
        view.loadDataWithBaseURL(
            "$origin/",
            html,
            "text/html",
            StandardCharsets.UTF_8.name(),
            origin + HISTORY_PATH,
        )
    }

    private const val TAG = "PortalOfflinePage"
    private const val MISSING_ASSET_HTML =
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
            "<title>MathsMine3</title></head><body><p>MathsMine3 offline.</p></body></html>"
}
