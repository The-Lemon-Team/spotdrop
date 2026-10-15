package com.bandita.player.domain.model

enum class PlayStrategy {
    FIRST_MATCH,
    PINNED_ONLY,
    MANUAL_SELECT
}

data class YouTubeCandidate(
    val videoId: String,
    val title: String,
    val channel: String,
    val durationText: String = "",
    val durationSeconds: Long = 0L,
    val thumbnailUrl: String = "",
    val isPinned: Boolean = false
)
