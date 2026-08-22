package xyz.mathsmine3.nativeapp.ui.home

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.view.MotionEvent
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import xyz.mathsmine3.nativeapp.PortalEmbedFallback
import xyz.mathsmine3.nativeapp.PortalEmbedWebViewClient
import xyz.mathsmine3.nativeapp.PortalOfflinePage
import xyz.mathsmine3.nativeapp.PortalOrigin
import xyz.mathsmine3.nativeapp.keepParentFromStealingTouches
import xyz.mathsmine3.nativeapp.applyPortalDefaults
import xyz.mathsmine3.nativeapp.ui.SoundPrefsBridge

/**
 * Portal [HomeWorldMinimap] for the native home logo toggle.
 * Prefer `/embed/home-minimap`; fall back to live home + open map + strip chrome.
 */
@SuppressLint("SetJavaScriptEnabled")
class HomeMinimapWebView(context: Context) : WebView(context) {

    var onClose: (() -> Unit)? = null
    private val fallback = PortalEmbedFallback(this, "/embed/home-minimap") { FALLBACK_URL }
    private var language: String = "en"

    init {
        setBackgroundColor(Color.parseColor("#01070E"))
        settings.applyPortalDefaults()
        addJavascriptInterface(NativeBridge(), "MM3NativeMinimap")
        webChromeClient = WebChromeClient()
        SoundPrefsBridge.attach(this)
        webViewClient = object : PortalEmbedWebViewClient(fallback) {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                SoundPrefsBridge.injectInto(this@HomeMinimapWebView)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (PortalOfflinePage.isOfflineContent(url)) {
                    SoundPrefsBridge.injectInto(this@HomeMinimapWebView)
                    return
                }
                if (fallback.usedRemote || url?.contains("/embed/home-minimap") != true) {
                    injectFallbackMap()
                } else {
                    evaluateJavascript(
                        "document.documentElement.classList.add('mm3-native-embed','mm3-native-minimap-embed');",
                        null,
                    )
                }
                SoundPrefsBridge.injectInto(this@HomeMinimapWebView)
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
        fallback.reset()
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
        keepParentFromStealingTouches(event)
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
