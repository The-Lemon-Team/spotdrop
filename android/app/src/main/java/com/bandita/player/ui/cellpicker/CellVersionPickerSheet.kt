package com.bandita.player.ui.cellpicker

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.bandita.player.data.youtube.YouTubeResolver
import com.bandita.player.domain.model.TrackCell
import com.bandita.player.domain.model.YouTubeCandidate
import com.bandita.player.playback.BanditaPlayerManager
import com.bandita.player.ui.theme.DarkBackground
import com.bandita.player.ui.theme.DarkBorder
import com.bandita.player.ui.theme.DarkSurface
import com.bandita.player.ui.theme.DarkSurfaceVariant
import com.bandita.player.ui.theme.NeonCyan
import com.bandita.player.ui.theme.NeonPink
import com.bandita.player.ui.theme.TextMuted
import com.bandita.player.ui.theme.TextPrimary
import com.bandita.player.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CellVersionPickerSheet(
    track: TrackCell,
    onDismiss: () -> Unit,
    onPinMatch: (YouTubeCandidate) -> Unit,
    onUnpin: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("${track.artist} ${track.title} audio") }
    var candidates by remember { mutableStateOf<List<YouTubeCandidate>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    fun runSearch(query: String) {
        isLoading = true
        scope.launch {
            val results = YouTubeResolver.searchCandidates(query, limit = 8)
            candidates = results
            isLoading = false
        }
    }

    LaunchedEffect(track.id) {
        runSearch(searchQuery)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DarkBackground,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Track Cell: Match Resolver",
                        style = MaterialTheme.typography.titleLarge,
                        color = NeonCyan
                    )
                    Text(
                        text = "${track.artist} • ${track.title}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TextSecondary)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Query Edit Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier.weight(1f),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonCyan,
                        unfocusedBorderColor = DarkBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        cursorColor = NeonCyan
                    ),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = { runSearch(searchQuery) },
                    modifier = Modifier
                        .background(NeonCyan, RoundedCornerShape(8.dp))
                        .size(48.dp)
                ) {
                    Icon(Icons.Default.Search, contentDescription = "Search", tint = DarkBackground)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Current Status & Reset option
            if (track.hasPinnedMatch) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(DarkSurfaceVariant)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.PushPin, contentDescription = null, tint = NeonCyan, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Current: Pinned to \"${track.pinnedTitle ?: ""}\"",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextPrimary,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Reset to Auto",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = NeonPink,
                        modifier = Modifier.clickable { onUnpin() }
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Results List
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = NeonCyan)
                }
            } else if (candidates.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No YouTube matches found. Try adjusting query.", color = TextMuted)
                }
            } else {
                Text(
                    text = "Select matching version to link with this song cell:",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(340.dp)
                ) {
                    items(candidates) { candidate ->
                        val isCurrentPinned = (track.pinnedVideoId == candidate.videoId)

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isCurrentPinned) DarkSurfaceVariant else DarkSurface)
                                .border(
                                    width = if (isCurrentPinned) 1.5.dp else 1.dp,
                                    color = if (isCurrentPinned) NeonCyan else DarkBorder,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Thumbnail
                            AsyncImage(
                                model = candidate.thumbnailUrl,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(width = 68.dp, height = 48.dp)
                                    .clip(RoundedCornerShape(6.dp)),
                                contentScale = ContentScale.Crop
                            )

                            Spacer(modifier = Modifier.width(10.dp))

                            // Details
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = candidate.title,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                    color = TextPrimary,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = candidate.channel,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondary,
                                        maxLines = 1
                                    )
                                    if (candidate.durationText.isNotEmpty()) {
                                        Text(
                                            text = " • ${candidate.durationText}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = TextMuted
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            // Play / Preview button
                            IconButton(
                                onClick = {
                                    BanditaPlayerManager.playCandidateForTrack(track, candidate)
                                },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = "Preview", tint = NeonCyan)
                            }

                            // Pin / Set button
                            Button(
                                onClick = { onPinMatch(candidate) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isCurrentPinned) NeonCyan else DarkBorder,
                                    contentColor = if (isCurrentPinned) DarkBackground else TextPrimary
                                ),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.height(34.dp)
                            ) {
                                if (isCurrentPinned) {
                                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                                } else {
                                    Text("Pin", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
