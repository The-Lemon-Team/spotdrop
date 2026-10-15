package com.bandita.player

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.bandita.player.data.importer.SpotifyImporter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class BanditaApplication : Application() {

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()

        createNotificationChannel()

        // Asynchronously check and import bundled JSON library & playlists on first run
        applicationScope.launch {
            SpotifyImporter.importDefaultsIfEmpty(applicationContext)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Bandita Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Bandita audio playback notification"
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "bandita_audio_channel"
    }
}
