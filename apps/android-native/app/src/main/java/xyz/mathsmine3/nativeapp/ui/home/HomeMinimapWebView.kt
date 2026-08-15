package xyz.mathsmine3.nativeapp.ui.home

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.view.MotionEvent
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import xyz.mathsmine3.nativeapp.PortalOrigin
import xyz.mathsmine3.nativeapp.PortalWebViewSecurity
import xyz.mathsmine3.nativeapp.handleLocalPortalSsl
import xyz.mathsmine3.nativeapp.ui.SoundPrefsBridge

/**
 * Portal [HomeWorldMinimap] for the native home logo toggle.
 * Prefer `/embed/home-minimap`; fall back to live home + open map + strip chrome.
 */
@SuppressLint("SetJavaScriptEnabled")
class HomeMinimapWebView(context: Context) : WebView(context) {

    var onClose: (() -> Unit)? = null
    private var usedFallback = false
    private var language: String = "en"

    init {
        setBackgroundColor(Color.parseColor("#01070E"))
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setMediaPlaybackRequiresUserGesture(false)
            allowFileAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }
        addJavascriptInterface(NativeBridge(), "MM3NativeMinimap")
        webChromeClient = WebChromeClient()
        SoundPrefsBridge.attach(this)
        webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean = PortalWebViewSecurity.shouldBlockNavigation(view, request)

            override fun onReceivedSslError(
                view: WebView?,
                handler: android.webkit.SslErrorHandler?,
                error: android.net.http.SslError?,
            ) {
                if (handleLocalPortalSsl(view, handler, error)) return
                super.onReceivedSslError(view, handler, error)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                SoundPrefsBridge.injectInto(this@HomeMinimapWebView)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (usedFallback || url?.contains("/embed/home-minimap") != true) {
                    injectFallbackMap()
                } else {
                    evaluateJavascript(
                        "document.documentElement.classList.add('mm3-native-embed','mm3-native-minimap-embed');",
                        null,
                    )
                }
                SoundPrefsBridge.injectInto(this@HomeMinimapWebView)
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: android.webkit.WebResourceResponse?,
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val u = request?.url?.toString().orEmpty()
                val code = errorResponse?.statusCode ?: 0
                if (request?.isForMainFrame == true && u.contains("/embed/home-minimap") && code >= 400 && !usedFallback) {
                    usedFallback = true
                    post { loadUrl(FALLBACK_URL) }
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame != true) return
                val u = request.url?.toString().orEmpty()
                if (u.contains("/embed/home-minimap") && !usedFallback) {
                    usedFallback = true
                    post { loadUrl(FALLBACK_URL) }
                }
            }
        }
        layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
    }

    fun setLanguage(lang: String) {
        val next = if (lang.startsWith("es", ignoreCase = true)) "es" else "en"
        if (next == language) return
        language = next
        // Reload so ?lang= and injected prefs match the header toggle.
        if (!url.isNullOrBlank()) loadMinimap()
    }

    fun loadMinimap() {
        usedFallback = false
        loadUrl("$EMBED_URL?lang=$language")
    }

    private fun injectFallbackMap() {
        evaluateJavascript(
            """
            (function(){
              try {
                document.documentElement.classList.add('mm3-native-embed','mm3-native-minimap-embed');
                var css = document.createElement('style');
                css.id = 'mm3-native-minimap-fallback-css';
                css.textContent = `
                  header, footer, nav, .CookieBanner, [class*="cookie"],
                  .mm3-home-access-stage, .mm3-home-arena, .mm3-splash-grid,
                  .mm3-splash-orb, .mm3-splash-scanlines, .mm3-nonagon-arrow,
                  .mm3-nonagon-caption, .mm3-nonagon-ring-row .mm3-nonagon-svg,
                  .mm3-nonagon-core {
                    display: none !important;
                  }
                  .mm3-shell-main, .mm3-home, .mm3-splash, .mm3-splash-body,
                  .mm3-home-access, .mm3-home-underrow, .mm3-nonagon, .mm3-nonagon.is-open {
                    padding: 0 !important;
                    margin: 0 !important;
                    height: auto !important;
                    min-height: 0 !important;
                    background: #01070e !important;
                  }
                  body, html {
                    background: #01070e !important;
                    overflow: auto !important;
                  }
                  .mm3-nonagon-mapfull, .mm3-home-worldmap {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                  }
                `;
                if (!document.getElementById('mm3-native-minimap-fallback-css')) {
                  document.documentElement.appendChild(css);
                }
                var core = document.querySelector('.mm3-nonagon-core');
                if (core) core.click();
                var mapBtn = document.querySelector('.mm3-nonagon-mapfull');
                if (mapBtn && !mapBtn.__mm3CloseBound) {
                  mapBtn.__mm3CloseBound = true;
                  mapBtn.addEventListener('click', function(){
                    if (window.MM3NativeMinimap && window.MM3NativeMinimap.close) {
                      window.MM3NativeMinimap.close();
                    }
                  }, true);
                }
              } catch (e) {}
            })();
            """.trimIndent(),
            null,
        )
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN ->
                parent?.requestDisallowInterceptTouchEvent(true)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
                parent?.requestDisallowInterceptTouchEvent(false)
        }
        return super.onTouchEvent(event)
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun close() {
            post { onClose?.invoke() }
        }
    }

    companion object {
        val EMBED_URL get() = PortalOrigin.url("/embed/home-minimap")
        val FALLBACK_URL get() = PortalOrigin.url("/")
    }
}
