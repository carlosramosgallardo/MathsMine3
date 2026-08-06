package xyz.mathsmine3.nativeapp.ui.home

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.view.MotionEvent
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import xyz.mathsmine3.nativeapp.PortalOrigin
import xyz.mathsmine3.nativeapp.PortalWebViewSecurity
import xyz.mathsmine3.nativeapp.handleLocalPortalSsl
import xyz.mathsmine3.nativeapp.ui.SoundPrefsBridge
import java.net.URLEncoder

/**
 * Renders the real portal home arena (Three.js HomeMiningWorld3D) inside a
 * WebView so avatars, GLBs, masks and textures match the web 1:1.
 *
 * Prefers the bare embed route; falls back to the live home with CSS that
 * strips chrome and keeps only the 3D stage.
 */
@SuppressLint("SetJavaScriptEnabled")
class HomeArenaWebView(context: Context) : WebView(context) {
    var arenaReady = false
        private set
    private var sessionWallet: String? = null
    private val WALLET_RE = Regex("^0x[0-9a-fA-F]{40}$")

    init {
        setBackgroundColor(Color.parseColor("#070B0F"))
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            // Needed for Three.js WebGL
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }
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
                SoundPrefsBridge.injectInto(this@HomeArenaWebView)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                SoundPrefsBridge.injectInto(this@HomeArenaWebView)
                injectArenaChrome()
                arenaReady = true
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: android.webkit.WebResourceRequest?,
                errorResponse: android.webkit.WebResourceResponse?,
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val u = request?.url?.toString().orEmpty()
                val code = errorResponse?.statusCode ?: 0
                if (request?.isForMainFrame == true && u.contains("/embed/home-arena") && code >= 400) {
                    // Embed not deployed yet — use live home + CSS strip.
                    post { loadUrl(FALLBACK_URL) }
                }
            }
        }
        layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
        // Loaded later via loadArena() after session wallet is set.
    }

    fun setSessionWallet(wallet: String?) {
        sessionWallet = wallet?.trim()?.takeIf { it.isNotEmpty() }
    }

    fun loadArena() {
        loadUrl(buildUrl())
    }

    private fun buildUrl(): String {
        val w = sessionWallet ?: return EMBED_URL
        if (!w.matches(WALLET_RE)) return EMBED_URL
        val encoded = URLEncoder.encode(w.lowercase(), Charsets.UTF_8.name())
        return "$EMBED_URL?mm3_gw=$encoded"
    }

    fun cycleWithNonagon() {
        evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('mm3-home-cycle'));",
            null,
        )
    }

    private fun injectArenaChrome() {
        val w = sessionWallet?.takeIf { it.matches(WALLET_RE) }?.lowercase()
        val walletBlock = if (w != null) "localStorage.setItem('mm3_gw','$w');" else ""
        val js = """
            (function(){
              try {
                $walletBlock
                document.documentElement.classList.add('mm3-native-embed','mm3-native-app');
                window.__MM3_NATIVE_APP__ = true;
                var css = document.createElement('style');
                css.id = 'mm3-native-arena-css';
                css.textContent = `
                  header, footer, nav, .CookieBanner, [class*="cookie"],
                  .mm3-home-underrow, .mm3-nonagon, .mm3-home-access-text {
                    display: none !important;
                  }
                  .mm3-shell-main {
                    padding: 0 !important;
                    margin: 0 !important;
                    height: 100% !important;
                    overflow: hidden !important;
                  }
                  body, html {
                    background: #070b0f !important;
                    overflow: hidden !important;
                    height: 100% !important;
                  }
                  .mm3-home, .mm3-splash, .mm3-splash-body, .mm3-home-access {
                    height: 100% !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .mm3-home-access-stage, .mm3-home-arena {
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 0 !important;
                    max-height: 100% !important;
                  }
                  .mm3-home-arena canvas {
                    width: 100% !important;
                    height: 100% !important;
                  }
                `;
                if (!document.getElementById('mm3-native-arena-css')) {
                  document.documentElement.appendChild(css);
                }
                // If embed page already bare, still fine.
                var embed = document.querySelector('.mm3-home-arena-embed');
                if (embed) {
                  embed.style.width = '100%';
                  embed.style.height = '100%';
                }
              } catch (e) {}
            })();
        """.trimIndent()
        evaluateJavascript(js, null)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        // Keep horizontal drags inside the WebView (carousel rail).
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN ->
                parent?.requestDisallowInterceptTouchEvent(true)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
                parent?.requestDisallowInterceptTouchEvent(false)
        }
        return super.onTouchEvent(event)
    }

    companion object {
        val EMBED_URL get() = PortalOrigin.url("/embed/home-arena")
        val FALLBACK_URL get() = PortalOrigin.url("/")
    }
}
