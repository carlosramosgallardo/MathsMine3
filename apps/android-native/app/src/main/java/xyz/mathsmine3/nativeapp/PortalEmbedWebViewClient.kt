package xyz.mathsmine3.nativeapp

import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

/** Shared main-frame error recovery for portal embed WebViews. */
open class PortalEmbedWebViewClient(
    private val fallback: PortalEmbedFallback,
    private val blockUnknownHosts: Boolean = true,
) : WebViewClient() {
    override fun shouldOverrideUrlLoading(
        view: WebView?,
        request: WebResourceRequest?,
    ): Boolean {
        if (!blockUnknownHosts) return super.shouldOverrideUrlLoading(view, request)
        return PortalWebViewSecurity.shouldBlockNavigation(view, request)
    }

    override fun onReceivedSslError(
        view: WebView?,
        handler: android.webkit.SslErrorHandler?,
        error: android.net.http.SslError?,
    ) {
        if (handleLocalPortalSsl(view, handler, error)) return
        super.onReceivedSslError(view, handler, error)
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?,
    ) {
        super.onReceivedHttpError(view, request, errorResponse)
        fallback.consumeMainFrameHttpError(request, errorResponse)
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?,
    ) {
        super.onReceivedError(view, request, error)
        onEmbedLoadFailed(request, error, fallback.consumeMainFrameError(request))
    }

    protected open fun onEmbedLoadFailed(
        request: WebResourceRequest?,
        error: WebResourceError?,
        recovered: Boolean,
    ) = Unit
}
