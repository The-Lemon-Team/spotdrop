package com.bandita.player.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bandita.player.data.local.BanditaDatabase
import com.bandita.player.data.storage.SpotDropStorageManager
import com.bandita.player.domain.model.TrackCell
import com.bandita.player.domain.model.YouTubeCandidate
import com.bandita.player.playback.BanditaPlayerManager
import com.bandita.player.ui.cellpicker.CellVersionPickerSheet
import com.bandita.player.ui.player.BottomPlayerBar
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
fun HomeScreen(
    database: BanditaDatabase,
    onNavigateToProfiles: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val trackDao = database.trackDao()
    val profileDao = database.profileDao()

    val currentProfile by profileDao.getCurrentProfileFlow().collectAsState(initial = null)
    val profileId = currentProfile?.id ?: "profile_default"

    var searchQuery by remember { mutableStateOf("") }
    var selectedTag by remember { mutableStateOf("#all") }
    var inspectingTrack by remember { mutableStateOf<TrackCell?>(null) }
    var showStorageDialog by remember { mutableStateOf(false) }
    var scanMessage by remember { mutableStateOf<String?>(null) }
    var isScanning by remember { mutableStateOf(false) }

    val offlineCount by trackDao.getOfflineTrackCountFlow(profileId).collectAsState(initial = 0)

    val folderPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            isScanning = true
            scanMessage = "Scanning selected folder..."
            scope.launch {
                val stats = SpotDropStorageManager.scanDocumentTree(context, uri, profileId)
                isScanning = false
                scanMessage = stats.message
            }
        }
    }

    // Reactive stream based on search and tag
    val trackEntitiesFlow = remember(profileId, searchQuery, selectedTag) {
        when {
            searchQuery.isNotBlank() -> trackDao.searchTracks(profileId, searchQuery)
            selectedTag == "#favorites" -> trackDao.getFavorites(profileId)
            selectedTag == "#offline" -> trackDao.getOfflineTracks(profileId)
            selectedTag != "#all" -> trackDao.getTracksByTag(profileId, selectedTag)
            else -> trackDao.getAllTracks(profileId)
        }
    }
    val trackEntities by trackEntitiesFlow.collectAsState(initial = emptyList())
    val tracks = remember(trackEntities) { trackEntities.map { it.toDomain() } }

    val defaultTags = listOf("#all", "#offline", "#favorites", "#summer", "#studio", "#spring", "#library", "#trance")

    Scaffold(
        containerColor = DarkBackground,
        bottomBar = {
            BottomPlayerBar()
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Top App Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "SPOTDROP",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 2.sp
                        ),
                        color = NeonCyan
                    )
                    Text(
                        text = "${currentProfile?.name ?: "Local Library"} • ${tracks.size} tracks • 💾 $offlineCount offline",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }

                IconButton(
                    onClick = { showStorageDialog = true },
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(DarkSurfaceVariant)
                ) {
                    Icon(
                        Icons.Default.Folder,
                        contentDescription = "Library & Storage",
                        tint = NeonCyan
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = onNavigateToProfiles,
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(DarkSurfaceVariant)
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = "Profiles",
                        tint = NeonCyan
                    )
                }
            }

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                placeholder = {
                    Text("Search title, artist, or #tag...", color = TextMuted)
                },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = NeonCyan)
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextSecondary)
                        }
                    }
                },
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = NeonCyan,
                    unfocusedBorderColor = DarkBorder,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    cursorColor = NeonCyan,
                    focusedContainerColor = DarkSurface,
                    unfocusedContainerColor = DarkSurface
                ),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Horizontal Tags Bar
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(defaultTags) { tag ->
                    val isSelected = (selectedTag == tag) && searchQuery.isEmpty()
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            searchQuery = ""
                            selectedTag = tag
                        },
                        label = {
                            Text(
                                text = tag,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) DarkBackground else TextPrimary
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            containerColor = DarkSurface,
                            selectedContainerColor = NeonCyan
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            borderColor = if (isSelected) NeonCyan else DarkBorder,
                            enabled = true,
                            selected = isSelected
                        ),
                        shape = RoundedCornerShape(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Quick Shuffle / Play Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (searchQuery.isNotEmpty()) "Results for \"$searchQuery\"" else "$selectedTag Tracks",
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary
                )

                Button(
                    onClick = {
                        if (tracks.isNotEmpty()) {
                            val shuffled = tracks.shuffled()
                            BanditaPlayerManager.playTrack(shuffled.first(), shuffled)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonCyan,
                        contentColor = DarkBackground
                    ),
                    shape = RoundedCornerShape(20.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Shuffle, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Shuffle", fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Track Cells List
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                if (tracks.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 32.dp),
                            colors = CardDefaults.cardColors(containerColor = DarkSurface),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(text = "🎵", fontSize = 40.sp)
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "Library is Empty",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = TextPrimary
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Spotify files are optional. You can bind your Spotify export JSON in Profiles or place profiles in the defaults folder.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextSecondary,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(
                                    onClick = onNavigateToProfiles,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = NeonCyan,
                                        contentColor = DarkBackground
                                    ),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text("Open Profiles & Import", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                } else {
                    items(tracks, key = { it.id }) { track ->
                        TrackCellCard(
                            track = track,
                            onPlay = {
                                BanditaPlayerManager.playTrack(track, tracks)
                            },
                            onOpenVersionPicker = {
                                inspectingTrack = track
                            },
                            onToggleFavorite = {
                                scope.launch {
                                    trackDao.toggleFavorite(track.id)
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    // Modal Sheet for choosing Track Cell match
    inspectingTrack?.let { cell ->
        CellVersionPickerSheet(
            track = cell,
            onDismiss = { inspectingTrack = null },
            onPinMatch = { candidate: YouTubeCandidate ->
                scope.launch {
                    trackDao.pinYouTubeMatch(
                        trackId = cell.id,
                        videoId = candidate.videoId,
                        title = candidate.title,
                        channel = candidate.channel,
                        duration = candidate.durationText,
                        thumbnail = candidate.thumbnailUrl
                    )
                    inspectingTrack = null
                }
            },
            onUnpin = {
                scope.launch {
                    trackDao.unpinYouTubeMatch(cell.id)
                    inspectingTrack = null
                }
            }
        )
    }

    if (showStorageDialog) {
        StorageSettingsDialog(
            offlineCount = offlineCount,
            scanMessage = scanMessage,
            isScanning = isScanning,
            onDismiss = { showStorageDialog = false },
            onPickFolder = {
                folderPickerLauncher.launch(null)
            },
            onRescan = {
                val currentFolder = SpotDropStorageManager.getLibraryDir(context)
                isScanning = true
                scanMessage = "Rescanning folder: ${currentFolder.name}..."
                scope.launch {
                    val stats = SpotDropStorageManager.scanDirectory(context, currentFolder, profileId)
                    isScanning = false
                    scanMessage = stats.message
                }
            }
        )
    }
}

@Composable
fun TrackCellCard(
    track: TrackCell,
    onPlay: () -> Unit,
    onOpenVersionPicker: () -> Unit,
    onToggleFavorite: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onPlay() },
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Play icon button
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(DarkSurfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.PlayArrow,
                    contentDescription = "Play",
                    tint = if (track.isOffline) Color(0xFF10B981) else NeonCyan,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Track details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${track.artist} • ${track.album}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Tags & Match status badge
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val statusText = when {
                        track.isOffline -> "💾 Offline"
                        track.hasPinnedMatch -> "📌 Pinned"
                        else -> "⚡ Auto Match"
                    }
                    val statusColor = when {
                        track.isOffline -> Color(0xFF10B981)
                        track.hasPinnedMatch -> NeonCyan
                        else -> TextMuted
                    }
                    Text(
                        text = statusText,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = statusColor
                    )

                    // Display up to 2 tags
                    track.tags.filter { it != "#all" }.take(2).forEach { tag ->
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(DarkSurfaceVariant)
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(text = tag, style = MaterialTheme.typography.labelSmall, color = NeonPink)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Favorite button
            IconButton(
                onClick = onToggleFavorite,
                modifier = Modifier.size(36.dp)
            ) {
                Icon(
                    imageVector = if (track.isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = "Favorite",
                    tint = if (track.isFavorite) NeonPink else TextMuted,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Cell Version Switcher button (🎛️ icon)
            IconButton(
                onClick = onOpenVersionPicker,
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(DarkSurfaceVariant)
            ) {
                Icon(
                    imageVector = Icons.Default.Tune,
                    contentDescription = "Choose YouTube Match",
                    tint = if (track.hasPinnedMatch) NeonCyan else TextSecondary,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
fun StorageSettingsDialog(
    offlineCount: Int,
    scanMessage: String?,
    isScanning: Boolean,
    onDismiss: () -> Unit,
    onPickFolder: () -> Unit,
    onRescan: () -> Unit
) {
    val context = LocalContext.current
    var cacheEnabled by remember { mutableStateOf(SpotDropStorageManager.isCacheEnabled(context)) }
    val currentDir = SpotDropStorageManager.getLibraryDir(context)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = DarkSurface,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Folder, contentDescription = null, tint = NeonCyan)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Library & Offline Storage", color = TextPrimary, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Active Folder:",
                    style = MaterialTheme.typography.labelMedium,
                    color = TextSecondary
                )
                Text(
                    text = currentDir.absolutePath,
                    style = MaterialTheme.typography.bodySmall,
                    color = NeonCyan,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Offline Tracks: $offlineCount ready to play without internet",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Auto-Cache YouTube Streams", color = TextPrimary, fontWeight = FontWeight.Medium)
                        Text("Save tracks to audio/ while listening", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                    }
                    Switch(
                        checked = cacheEnabled,
                        onCheckedChange = {
                            cacheEnabled = it
                            SpotDropStorageManager.setCacheEnabled(context, it)
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = NeonCyan,
                            checkedTrackColor = DarkSurfaceVariant
                        )
                    )
                }

                if (scanMessage != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = scanMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = NeonPink
                    )
                }

                if (isScanning) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Scanning files...",
                        style = MaterialTheme.typography.bodySmall,
                        color = NeonCyan
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onPickFolder,
                colors = ButtonDefaults.buttonColors(containerColor = NeonCyan, contentColor = DarkBackground)
            ) {
                Text("Choose Folder", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            Row {
                Button(
                    onClick = onRescan,
                    colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant, contentColor = TextPrimary)
                ) {
                    Text("Rescan")
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant, contentColor = TextSecondary)
                ) {
                    Text("Close")
                }
            }
        }
    )
}
