package com.bandita.player.playback

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.bandita.player.data.local.BanditaDatabase
import com.bandita.player.data.storage.SpotDropStorageManager
import com.bandita.player.data.youtube.YouTubeResolver
import com.bandita.player.domain.model.PlayStrategy
import com.bandita.player.domain.model.TrackCell
import com.bandita.player.domain.model.YouTubeCandidate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

object BanditaPlayerManager {

    private var exoPlayer: ExoPlayer? = null
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var progressJob: Job? = null

    private val _currentTrack = MutableStateFlow<TrackCell?>(null)
    val currentTrack = _currentTrack.asStateFlow()

    private val _activeCandidate = MutableStateFlow<YouTubeCandidate?>(null)
    val activeCandidate = _activeCandidate.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying = _isPlaying.asStateFlow()

    private val _isBuffering = MutableStateFlow(false)
    val isBuffering = _isBuffering.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration = _duration.asStateFlow()

    private val _queue = MutableStateFlow<List<TrackCell>>(emptyList())
    val queue = _queue.asStateFlow()

    private val _queueIndex = MutableStateFlow(0)
    val queueIndex = _queueIndex.asStateFlow()

    private val _playStrategy = MutableStateFlow(PlayStrategy.FIRST_MATCH)
    val playStrategy = _playStrategy.asStateFlow()

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(playing: Boolean) {
            _isPlaying.value = playing
            if (playing) startProgressTracking() else stopProgressTracking()
        }

        override fun onPlaybackStateChanged(state: Int) {
            _isBuffering.value = (state == Player.STATE_BUFFERING)
            if (state == Player.STATE_READY) {
                _duration.value = exoPlayer?.duration?.coerceAtLeast(0L) ?: 0L
            } else if (state == Player.STATE_ENDED) {
                playNext()
            }
        }
    }

    private var appContext: Context? = null

    fun attachPlayer(player: ExoPlayer, context: Context? = null) {
        exoPlayer = player
        appContext = context?.applicationContext
        player.addListener(playerListener)
    }

    fun detachPlayer() {
        exoPlayer?.removeListener(playerListener)
        exoPlayer = null
        appContext = null
        stopProgressTracking()
    }

    fun playTrack(track: TrackCell, newQueue: List<TrackCell>? = null) {
        if (newQueue != null) {
            _queue.value = newQueue
            _queueIndex.value = newQueue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
        }
        _currentTrack.value = track

        scope.launch {
            _isBuffering.value = true

            // Strategy execution:
            val candidate = if (track.hasPinnedMatch) {
                YouTubeCandidate(
                    videoId = track.pinnedVideoId!!,
                    title = track.pinnedTitle ?: track.title,
                    channel = track.pinnedChannel ?: track.artist,
                    durationText = track.pinnedDuration ?: "",
                    thumbnailUrl = track.pinnedThumbnail ?: "",
                    isPinned = true
                )
            } else {
                // First match auto strategy:
                val query = "${track.artist} ${track.title} audio"
                val candidates = YouTubeResolver.searchCandidates(query, limit = 1)
                candidates.firstOrNull() ?: YouTubeCandidate(
                    videoId = "",
                    title = track.title,
                    channel = track.artist
                )
            }

            _activeCandidate.value = candidate

            if (candidate.videoId.isNotEmpty()) {
                val context = appContext
                val localFile = if (context != null) {
                    SpotDropStorageManager.findLocalAudioFile(context, candidate.videoId)
                } else null

                if (localFile != null && localFile.exists()) {
                    _isBuffering.value = false
                    startExoPlayback(track, candidate, Uri.fromFile(localFile).toString())
                } else {
                    val streamUrl = YouTubeResolver.resolveAudioStreamUrl(candidate.videoId)
                    startExoPlayback(track, candidate, streamUrl)
                    triggerBackgroundCacheIfNeeded(track, candidate, streamUrl)
                }
            } else {
                _isBuffering.value = false
            }
        }
    }

    fun playCandidateForTrack(track: TrackCell, candidate: YouTubeCandidate) {
        _currentTrack.value = track
        _activeCandidate.value = candidate

        scope.launch {
            _isBuffering.value = true
            val context = appContext
            val localFile = if (context != null) {
                SpotDropStorageManager.findLocalAudioFile(context, candidate.videoId)
            } else null

            if (localFile != null && localFile.exists()) {
                _isBuffering.value = false
                startExoPlayback(track, candidate, Uri.fromFile(localFile).toString())
            } else {
                val streamUrl = YouTubeResolver.resolveAudioStreamUrl(candidate.videoId)
                startExoPlayback(track, candidate, streamUrl)
                triggerBackgroundCacheIfNeeded(track, candidate, streamUrl)
            }
        }
    }

    private fun triggerBackgroundCacheIfNeeded(track: TrackCell, candidate: YouTubeCandidate, streamUrl: String) {
        val context = appContext ?: return
        if (!SpotDropStorageManager.isCacheEnabled(context)) return
        if (candidate.videoId.isBlank() || streamUrl.isBlank() || !streamUrl.startsWith("http")) return

        val existing = SpotDropStorageManager.findLocalAudioFile(context, candidate.videoId)
        if (existing != null && existing.exists()) return

        scope.launch(Dispatchers.IO) {
            runCatching {
                val audioDir = SpotDropStorageManager.getAudioDir(context)
                val targetFile = File(audioDir, "${candidate.videoId}.webm")
                val tempFile = File(audioDir, "${candidate.videoId}.tmp")

                val client = OkHttpClient()
                val req = Request.Builder().url(streamUrl).build()
                client.newCall(req).execute().use { resp ->
                    if (resp.isSuccessful) {
                        resp.body?.byteStream()?.use { input ->
                            tempFile.outputStream().use { output ->
                                input.copyTo(output)
                            }
                        }
                        if (tempFile.exists() && tempFile.length() > 1024) {
                            tempFile.renameTo(targetFile)
                            val db = BanditaDatabase.getInstance(context)
                            db.trackDao().updateOfflineStatus(
                                trackId = track.id,
                                localFile = targetFile.name,
                                isCached = true,
                                fileSize = targetFile.length()
                            )
                        }
                    }
                }
            }
        }
    }

    private fun startExoPlayback(track: TrackCell, candidate: YouTubeCandidate, streamUrl: String) {
        val player = exoPlayer ?: return

        val metadata = MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist)
            .setAlbumTitle(track.album)
            .build()

        val mediaItem = MediaItem.Builder()
            .setUri(streamUrl)
            .setMediaId(candidate.videoId)
            .setMediaMetadata(metadata)
            .build()

        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()
    }

    fun togglePlayPause() {
        val player = exoPlayer ?: return
        if (player.isPlaying) {
            player.pause()
        } else {
            player.play()
        }
    }

    fun playNext() {
        val currentQ = _queue.value
        if (currentQ.isEmpty()) return

        val nextIndex = (_queueIndex.value + 1) % currentQ.size
        _queueIndex.value = nextIndex
        playTrack(currentQ[nextIndex])
    }

    fun playPrevious() {
        val currentQ = _queue.value
        if (currentQ.isEmpty()) return

        val prevIndex = if (_queueIndex.value - 1 < 0) currentQ.size - 1 else _queueIndex.value - 1
        _queueIndex.value = prevIndex
        playTrack(currentQ[prevIndex])
    }

    fun seekTo(positionMs: Long) {
        exoPlayer?.seekTo(positionMs)
        _currentPosition.value = positionMs
    }

    fun shuffleQueue() {
        val currentQ = _queue.value.toMutableList()
        val current = _currentTrack.value
        currentQ.shuffle()
        if (current != null) {
            currentQ.remove(current)
            currentQ.add(0, current)
            _queueIndex.value = 0
        }
        _queue.value = currentQ
    }

    private fun startProgressTracking() {
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive) {
                exoPlayer?.let { player ->
                    _currentPosition.value = player.currentPosition.coerceAtLeast(0L)
                    _duration.value = player.duration.coerceAtLeast(0L)
                }
                delay(500)
            }
        }
    }

    private fun stopProgressTracking() {
        progressJob?.cancel()
        progressJob = null
    }
}
