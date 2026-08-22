package xyz.mathsmine3.nativeapp

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView

/**
 * Two-step recovery for portal embeds: live URL first, packed HTML last.
 * Does not replace the WebView's normal portal document.
 */
class PortalEmbedFallback(
    private val view: WebView,
    private val embedNeedle: String,
    private val remoteFallbackUrl: () -> String,
) {
    var usedRemote: Boolean = false
        private set
    private var usedOffline: Boolean = false

    fun reset() {
        usedRemote = false
        usedOffline = false
    }

    /** @return true if a recovery navigation was scheduled. */
    fun onMainFrameFailure(failedUrl: String?): Boolean {
        val url = failedUrl.orEmpty()
        if (PortalOfflinePage.isOfflineContent(url)) return false
        if (!usedRemote && url.contains(embedNeedle)) {
            usedRemote = true
            view.post { view.loadUrl(remoteFallbackUrl()) }
            return true
        }
        if (usedRemote && !usedOffline) {
            usedOffline = true
            view.post { PortalOfflinePage.loadInto(view) }
            return true
        }
        return false
    }

    fun consumeMainFrameHttpError(
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?,
    ): Boolean {
        val code = errorResponse?.statusCode ?: 0
        if (request?.isForMainFrame != true || code < 400) return false
        return onMainFrameFailure(request.url?.toString())
    }

    fun consumeMainFrameError(request: WebResourceRequest?): Boolean {
        if (request?.isForMainFrame != true) return false
        return onMainFrameFailure(request.url?.toString())
    }
}
