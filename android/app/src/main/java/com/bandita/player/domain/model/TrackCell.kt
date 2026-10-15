package com.bandita.player.domain.model

data class TrackCell(
    val id: String, // Spotify track URI or generated UUID
    val profileId: String,
    val title: String,
    val artist: String,
    val album: String,
    val tags: List<String>,
    val isFavorite: Boolean = false,
    val pinnedVideoId: String? = null,
    val pinnedTitle: String? = null,
    val pinnedChannel: String? = null,
    val pinnedDuration: String? = null,
    val pinnedThumbnail: String? = null,
    val localAudioFile: String? = null,
    val isCached: Boolean = false,
    val fileSizeBytes: Long = 0L,
    val playCount: Int = 0
) {
    val hasPinnedMatch: Boolean get() = !pinnedVideoId.isNullOrBlank()
    val isOffline: Boolean get() = isCached || !localAudioFile.isNullOrBlank()
    val displayArtistTrack: String get() = "$artist - $title"
}

data class MusicProfile(
    val id: String,
    val name: String,
    val avatarEmoji: String = "🎵",
    val isCurrent: Boolean = false,
    val trackCount: Int = 0,
    val playlistCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)
