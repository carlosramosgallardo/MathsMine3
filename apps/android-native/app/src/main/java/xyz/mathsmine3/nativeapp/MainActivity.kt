package xyz.mathsmine3.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import xyz.mathsmine3.nativeapp.ui.Mm3AppRoot
import xyz.mathsmine3.nativeapp.ui.theme.Mm3Theme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as Mm3App
        setContent {
            Mm3Theme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF070B0F)) {
                    Mm3AppRoot(container = app.container)
                }
            }
        }
    }
}
