package xyz.mathsmine3.nativeapp.ui.screens

import android.annotation.SuppressLint
import android.graphics.Color
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import xyz.mathsmine3.nativeapp.auth.Session
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Colors

/**
 * Loads a portal page (API / Security / Privacy / Terms) inside the app shell.
 * Header/footer chrome is stripped — the native shell already provides them.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PortalDocScreen(
    url: String,
    session: Session,
) {
    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                setBackgroundColor(Color.parseColor("#070B0F"))
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                    setSupportZoom(false)
                }
                webChromeClient = WebChromeClient()
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?,
                    ): Boolean = false

                    override fun onPageFinished(view: WebView?, finishedUrl: String?) {
                        super.onPageFinished(view, finishedUrl)
                        val w = session.wallet?.lowercase()?.takeIf {
                            it.matches(Regex("^0x[a-fA-F0-9]{40}$"))
                        }
                        val sessionJs = if (w != null) {
                            "try{localStorage.setItem('mm3_gw','$w');}catch(e){}"
                        } else ""
                        evaluateJavascript(
                            """
                            (function(){
                              $sessionJs
                              try {
                                var css = document.createElement('style');
                                css.id = 'mm3-native-doc-css';
                                css.textContent = `
                                  header, footer, nav, .CookieBanner, [class*="cookie"] {
                                    display: none !important;
                                  }
                                  .mm3-shell-main {
                                    padding: 12px 10px 24px !important;
                                    margin: 0 !important;
                                    height: auto !important;
                                    overflow: auto !important;
                                  }
                                  body, html {
                                    background: #070b0f !important;
                                  }
                                `;
                                if (!document.getElementById('mm3-native-doc-css')) {
                                  document.documentElement.appendChild(css);
                                }
                              } catch (e) {}
                            })();
                            """.trimIndent(),
                            null,
                        )
                    }
                }
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                loadUrl(url)
            }
        },
        modifier = Modifier
            .fillMaxSize()
            .background(Mm3Colors.Bg),
        onRelease = {
            it.stopLoading()
            it.destroy()
        },
    )
}
