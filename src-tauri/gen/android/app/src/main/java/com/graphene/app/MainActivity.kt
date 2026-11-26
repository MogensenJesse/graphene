package com.graphene.app

import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
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
    enableEdgeToEdge()
  }
}
