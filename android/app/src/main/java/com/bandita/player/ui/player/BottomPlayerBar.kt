package com.bandita.player.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.bandita.player.playback.BanditaPlayerManager
import com.bandita.player.ui.theme.DarkBorder
import com.bandita.player.ui.theme.DarkSurfaceVariant
import com.bandita.player.ui.theme.NeonCyan
import com.bandita.player.ui.theme.TextMuted
import com.bandita.player.ui.theme.TextPrimary
import com.bandita.player.ui.theme.TextSecondary

@Composable
fun BottomPlayerBar(
    onBarClick: () -> Unit = {}
) {
    val currentTrack by BanditaPlayerManager.currentTrack.collectAsState()
    val isPlaying by BanditaPlayerManager.isPlaying.collectAsState()
    val isBuffering by BanditaPlayerManager.isBuffering.collectAsState()
    val position by BanditaPlayerManager.currentPosition.collectAsState()
    val duration by BanditaPlayerManager.duration.collectAsState()
    val candidate by BanditaPlayerManager.activeCandidate.collectAsState()

    if (currentTrack == null) return

    val track = currentTrack!!
    val progress = if (duration > 0) (position.toFloat() / duration.toFloat()).coerceIn(0f, 1f) else 0f

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .background(DarkSurfaceVariant)
            .clickable { onBarClick() }
    ) {
        // Linear Progress Bar
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(3.dp),
            color = NeonCyan,
            trackColor = DarkBorder,
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Artwork / Thumbnail
            val thumb = candidate?.thumbnailUrl?.ifEmpty { null }
            if (thumb != null) {
                AsyncImage(
                    model = thumb,
                    contentDescription = null,
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(DarkBorder),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🎵", fontSize = 22.sp)
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Title & Artist
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = track.title,
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = track.artist,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (track.hasPinnedMatch) "📌 Pinned" else "⚡ Auto Match",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (track.hasPinnedMatch) NeonCyan else TextMuted
                    )
                }
            }

            // Play / Pause / Loading button
            if (isBuffering) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .padding(8.dp)
                        .size(24.dp),
                    color = NeonCyan,
                    strokeWidth = 2.5.dp
                )
            } else {
                IconButton(onClick = { BanditaPlayerManager.togglePlayPause() }) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = NeonCyan,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            // Next button
            IconButton(onClick = { BanditaPlayerManager.playNext() }) {
                Icon(
                    imageVector = Icons.Default.SkipNext,
                    contentDescription = "Next",
                    tint = TextPrimary,
                    modifier = Modifier.size(28.dp)
                )
            }
        }
    }
}
