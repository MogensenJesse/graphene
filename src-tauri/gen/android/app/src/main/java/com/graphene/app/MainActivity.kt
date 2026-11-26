package com.graphene.app

import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

// Handed to the page as window.grapheneBars: it says which theme the page shows (the Theme setting, not the phone's mode), so the
// status and navigation bars' icons are light on a dark page and dark on a light one
class BarsBridge(private val activity: MainActivity) {
  @JavascriptInterface
  fun setDark(dark: Boolean) = activity.runOnUiThread { activity.setBarsDark(dark) }
}

class MainActivity : TauriActivity() {
  // The page's theme once it has said (null before: the phone's night mode decides, as enableEdgeToEdge() does by itself)
  private var barsDark: Boolean? = null

  private fun applyBars() {
    // The scrims are enableEdgeToEdge()'s defaults, drawn behind a 3-button navigation bar only
    val status = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT, this::barsAreDark)
    val navigation = SystemBarStyle.auto(Color.argb(0xe6, 0xFF, 0xFF, 0xFF), Color.argb(0x80, 0x1b, 0x1b, 0x1b), this::barsAreDark)
    enableEdgeToEdge(statusBarStyle = status, navigationBarStyle = navigation)
  }

  private fun barsAreDark(resources: android.content.res.Resources): Boolean =
    barsDark ?: ((resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES)

  fun setBarsDark(dark: Boolean) {
    if (barsDark == dark) return
    barsDark = dark
    applyBars()
  }

  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(BarsBridge(this), "grapheneBars")
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    applyBars()
    super.onCreate(savedInstanceState)
    // Edge-to-edge windows are not resized by the soft keyboard (the WebView only shrinks its visual viewport, and the page pans, so
    // the header and the formatting row scroll off the top). Pad the content by the keyboard's height instead: the WebView, and so
    // the page's window, ends where the keyboard starts.
    ViewCompat.setOnApplyWindowInsetsListener(findViewById<View>(android.R.id.content)) { view, insets ->
      view.updatePadding(bottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
      insets
    }
  }

  // uiMode is in configChanges, so a switch of the system's light or dark mode does not recreate the activity: set the system bars'
  // icon colours again, or they keep the old mode's (dark icons on the dark theme's near-black frame)
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyBars()
  }
}
