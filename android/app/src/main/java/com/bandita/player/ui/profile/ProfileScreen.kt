package com.bandita.player.ui.profile

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bandita.player.data.importer.SpotifyImporter
import com.bandita.player.data.local.BanditaDatabase
import com.bandita.player.data.local.entity.ProfileEntity
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
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    database: BanditaDatabase,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val profileDao = database.profileDao()
    val trackDao = database.trackDao()

    val profiles by profileDao.getAllProfiles().collectAsState(initial = emptyList())
    val currentProfile by profileDao.getCurrentProfileFlow().collectAsState(initial = null)

    var newProfileName by remember { mutableStateOf("") }
    var isImporting by remember { mutableStateOf(false) }
    var importMessage by remember { mutableStateOf<String?>(null) }

    // File picker for Spotify JSON
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            val activeId = currentProfile?.id ?: "profile_default"
            isImporting = true
            importMessage = "Importing Spotify file on device..."

            scope.launch {
                runCatching {
                    context.contentResolver.openInputStream(uri)?.use { stream ->
                        SpotifyImporter.importAutoDetectedStream(
                            context = context,
                            profileId = activeId,
                            stream = stream
                        )
                    }
                }.onSuccess {
                    importMessage = "Successfully imported tracks into local profile!"
                }.onFailure {
                    importMessage = "Import failed: ${it.message}"
                }
                isImporting = false
            }
        }
    }

    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Music Profiles & Spotify Binding",
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
        ) {
            // Profile Switcher Section
            Text(
                text = "LOCAL PROFILES",
                style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.5.sp),
                color = TextMuted
            )

            Spacer(modifier = Modifier.height(8.dp))

            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(profiles) { profile ->
                    val isSelected = (profile.id == currentProfile?.id)
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                scope.launch { profileDao.setCurrentProfile(profile.id) }
                            },
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) DarkSurfaceVariant else DarkSurface
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(DarkBackground),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(profile.avatarEmoji, fontSize = 20.sp)
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = profile.name,
                                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                                    color = TextPrimary
                                )
                                Text(
                                    text = if (isSelected) "Active Profile" else "Tap to switch",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (isSelected) NeonCyan else TextMuted
                                )
                            }

                            if (isSelected) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = NeonCyan)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Create New Profile
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newProfileName,
                    onValueChange = { newProfileName = it },
                    placeholder = { Text("New profile name...", color = TextMuted) },
                    modifier = Modifier.weight(1f),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonCyan,
                        unfocusedBorderColor = DarkBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedContainerColor = DarkSurface,
                        unfocusedContainerColor = DarkSurface
                    ),
                    singleLine = true,
                    shape = RoundedCornerShape(8.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        if (newProfileName.isNotBlank()) {
                            scope.launch {
                                val id = "profile_${UUID.randomUUID().toString().take(8)}"
                                profileDao.insertProfile(
                                    ProfileEntity(
                                        id = id,
                                        name = newProfileName.trim(),
                                        avatarEmoji = "🎧"
                                    )
                                )
                                profileDao.setCurrentProfile(id)
                                newProfileName = ""
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonCyan,
                        contentColor = DarkBackground
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add")
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Spotify JSON Binding Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LibraryMusic, contentDescription = null, tint = NeonCyan)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Bind Spotify Data",
                            style = MaterialTheme.typography.titleLarge,
                            color = TextPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Import your own YourLibrary.json or Playlist.json directly into your local profile. No server or login needed.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    if (isImporting) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = NeonCyan)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(importMessage ?: "Importing...", color = TextSecondary)
                        }
                    } else {
                        Button(
                            onClick = {
                                filePickerLauncher.launch(arrayOf("application/json", "*/*"))
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = DarkSurfaceVariant,
                                contentColor = TextPrimary
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.FileUpload, contentDescription = null, tint = NeonCyan)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Select Spotify JSON File")
                        }
                    }

                    importMessage?.let { msg ->
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = msg, style = MaterialTheme.typography.bodyMedium, color = NeonCyan)
                    }
                }
            }
        }
    }
}
