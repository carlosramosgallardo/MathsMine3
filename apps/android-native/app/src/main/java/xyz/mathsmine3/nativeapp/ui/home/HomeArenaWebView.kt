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
        webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
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
        // Live home + CSS chrome strip = same Three.js avatars/textures today.
        // Switch to EMBED_URL after /embed/home-arena is deployed to production.
        loadUrl(FALLBACK_URL)
    }

    fun cycleWithNonagon() {
        evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('mm3-home-cycle'));",
            null,
        )
    }

    private fun injectArenaChrome() {
        val js = """
            (function(){
              try {
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
                    height: 100vh !important;
                    overflow: hidden !important;
                  }
                  body, html {
                    background: #070b0f !important;
                    overflow: hidden !important;
                    height: 100% !important;
                  }
                  .mm3-home, .mm3-splash, .mm3-splash-body, .mm3-home-access {
                    height: 100vh !important;
                    min-height: 100vh !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .mm3-home-access-stage, .mm3-home-arena {
                    width: 100vw !important;
                    height: 100vh !important;
                    min-height: 100vh !important;
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
                  embed.style.width = '100vw';
                  embed.style.height = '100vh';
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
        const val EMBED_URL = "https://mathsmine3.xyz/embed/home-arena"
        const val FALLBACK_URL = "https://mathsmine3.xyz/"
    }
}
