package com.bandita.player.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.bandita.player.data.local.BanditaDatabase
import com.bandita.player.playback.BanditaAudioService
import com.bandita.player.ui.home.HomeScreen
import com.bandita.player.ui.profile.ProfileScreen
import com.bandita.player.ui.theme.BanditaPlayerTheme
import com.bandita.player.ui.theme.DarkBackground

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Start background media service
        val serviceIntent = Intent(this, BanditaAudioService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        val database = BanditaDatabase.getInstance(applicationContext)

        setContent {
            BanditaPlayerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DarkBackground
                ) {
                    AppNavigation(database = database)
                }
            }
        }
    }
}

@Composable
fun AppNavigation(database: BanditaDatabase) {
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Home) }

    when (currentScreen) {
        Screen.Home -> {
            HomeScreen(
                database = database,
                onNavigateToProfiles = { currentScreen = Screen.Profile }
            )
        }
        Screen.Profile -> {
            ProfileScreen(
                database = database,
                onBack = { currentScreen = Screen.Home }
            )
        }
    }
}

sealed class Screen {
    data object Home : Screen()
    data object Profile : Screen()
}
