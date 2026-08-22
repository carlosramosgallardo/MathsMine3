package xyz.mathsmine3.nativeapp.ui.mining

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.view.MotionEvent
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import java.net.URLEncoder
import xyz.mathsmine3.nativeapp.PortalEmbedFallback
import xyz.mathsmine3.nativeapp.PortalEmbedWebViewClient
import xyz.mathsmine3.nativeapp.PortalOrigin
import xyz.mathsmine3.nativeapp.keepParentFromStealingTouches
import xyz.mathsmine3.nativeapp.applyPortalDefaults
import xyz.mathsmine3.nativeapp.ui.SoundPrefsBridge

/**
 * Loads the real portal Mining FPV (Three.js MiningChain3DFPV) in a WebView.
 * Prefers bare `/embed/mining`; falls back to `/mining` + CSS chrome strip.
 */
@SuppressLint("SetJavaScriptEnabled")
class MiningWebView(context: Context) : WebView(context) {
    var pageReady = false
        private set

    var onReady: (() -> Unit)? = null
    var onLoadError: ((String) -> Unit)? = null

    private var sessionWallet: String? = null
    private val fallback = PortalEmbedFallback(this, "/embed/mining") { FALLBACK_URL }

    init {
        setBackgroundColor(Color.parseColor("#070B0F"))
        settings.applyPortalDefaults()
        webChromeClient = WebChromeClient()
        SoundPrefsBridge.attach(this)
        webViewClient = object : PortalEmbedWebViewClient(fallback) {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                pageReady = false
                injectSessionAndEmbedFlags()
                SoundPrefsBridge.injectInto(this@MiningWebView)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectSessionAndEmbedFlags()
                injectNativeChrome()
                SoundPrefsBridge.injectInto(this@MiningWebView)
                pageReady = true
                onReady?.invoke()
            }

            override fun onEmbedLoadFailed(
                request: WebResourceRequest?,
                error: WebResourceError?,
                recovered: Boolean,
            ) {
                if (request?.isForMainFrame == true && !recovered) {
                    onLoadError?.invoke(error?.description?.toString() ?: "load_error")
                }
            }
        }
        layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
    }

    /** Call before [loadMining] so `mm3_gw` is available when the portal boots. */
    fun setSessionWallet(wallet: String?) {
        sessionWallet = wallet?.trim()?.takeIf { it.isNotEmpty() }
    }

    fun loadMining() {
        fallback.reset()
        pageReady = false
        loadUrl(buildEmbedUrl())
    }

    private fun buildEmbedUrl(): String {
        val w = sessionWallet ?: return EMBED_URL
        if (!w.matches(WALLET_RE)) return EMBED_URL
        val encoded = URLEncoder.encode(w.lowercase(), Charsets.UTF_8.name())
        return "$EMBED_URL?mm3_gw=$encoded"
    }

    private fun injectSessionAndEmbedFlags() {
        val w = sessionWallet?.takeIf { it.matches(WALLET_RE) }?.lowercase()
        val walletBlock = if (w != null) {
            """
              localStorage.setItem('mm3_gw', '$w');
              window.__MM3_NATIVE_GW__ = '$w';
              window.dispatchEvent(new CustomEvent('mm3-native-session', { detail: { gw: '$w' } }));
            """.trimIndent()
        } else {
            ""
        }
        evaluateJavascript(
            """
            (function(){
              try {
                document.documentElement.classList.add('mm3-native-embed');
                window.__MM3_NATIVE_EMBED__ = true;
                window.__MM3_NATIVE_APP__ = true;
                $walletBlock
              } catch (e) {}
            })();
            """.trimIndent(),
            null,
        )
    }

    private fun injectNativeChrome() {
        // Chrome strip + touch forced for /mining fallback (and before CSS deploy).
        val js = """
            (function(){
              try {
                var css = document.createElement('style');
                css.id = 'mm3-native-mining-css';
                css.textContent = `
                  header, footer, nav, .CookieBanner, [class*="cookie"],
                  .mm3-header-ticker, .mm3-irc-header-row {
                    display: none !important;
                  }
                  .mm3-shell-main {
                    padding: 0 !important;
                    margin: 0 !important;
                    height: 100vh !important;
                    height: 100dvh !important;
                    overflow: hidden !important;
                  }
                  body, html {
                    background: #070b0f !important;
                    overflow: hidden !important;
                    height: 100% !important;
                    width: 100% !important;
                    max-width: none !important;
                  }
                  .mm3-mining3d-root {
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    height: 100% !important;
                  }
                  html.mm3-native-embed .mm3-touch-controls { display: flex !important; }
                  html.mm3-native-embed .mm3-desktop-controls { display: none !important; }
                  html.mm3-native-embed .mm3-desktop-only { display: none !important; }
                  html.mm3-native-embed .mm3-fpv-overlay-canvas { pointer-events: none !important; }
                  html.mm3-native-embed .mm3-touch-look-pad {
                    display: block !important;
                    position: absolute;
                    z-index: 4;
                    top: 11%;
                    left: 38%;
                    right: 0;
                    bottom: calc(108px + env(safe-area-inset-bottom, 0px));
                    pointer-events: auto;
                  }
                `;
                if (!document.getElementById('mm3-native-mining-css')) {
                  document.documentElement.appendChild(css);
                }
                document.documentElement.classList.add('mm3-native-embed');
              } catch (e) {}
            })();
        """.trimIndent()
        evaluateJavascript(js, null)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        keepParentFromStealingTouches(event)
        return super.onTouchEvent(event)
    }

    companion object {
        val EMBED_URL get() = PortalOrigin.url("/embed/mining")
        val FALLBACK_URL get() = PortalOrigin.url("/mining")
        private val WALLET_RE = Regex("^0x[a-fA-F0-9]{40}$")
    }
}
