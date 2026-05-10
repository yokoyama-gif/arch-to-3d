package com.example.gpsspeedoverlay.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.gpsspeedoverlay.service.LocationTrackingService
import com.example.gpsspeedoverlay.service.OverlayService
import com.example.gpsspeedoverlay.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onOpenAnalysis: () -> Unit,
    onOpenPermissions: () -> Unit,
    vm: MainViewModel = viewModel()
) {
    val ctx = LocalContext.current
    val tracking by vm.tracking.collectAsState()
    val intervalMs by vm.intervalMs.collectAsState()
    val overlayEnabled by vm.overlayEnabled.collectAsState()

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val granted = result.values.all { it }
        if (granted) LocationTrackingService.start(ctx, intervalMs)
    }
    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* no-op — service still starts */ }

    Scaffold(
        topBar = { TopAppBar(title = { Text("GPS速度オーバーレイ") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            LiveStatusCard(tracking)

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("計測", style = MaterialTheme.typography.titleMedium)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (tracking.isRunning) {
                            Button(
                                onClick = { LocationTrackingService.stop(ctx) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Stop, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("計測停止")
                            }
                        } else {
                            Button(
                                onClick = {
                                    if (Build.VERSION.SDK_INT >= 33) {
                                        notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                    }
                                    locationLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.ACCESS_FINE_LOCATION,
                                            Manifest.permission.ACCESS_COARSE_LOCATION
                                        )
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("計測開始")
                            }
                        }
                    }

                    Text("更新間隔：${intervalMs / 1000.0} 秒", style = MaterialTheme.typography.bodyMedium)
                    Slider(
                        value = intervalMs.toFloat(),
                        onValueChange = { vm.setIntervalMs(it.toLong().coerceIn(1000L, 5000L)) },
                        valueRange = 1000f..5000f,
                        steps = 3
                    )
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("オーバーレイ表示", style = MaterialTheme.typography.titleMedium)
                        Switch(
                            checked = overlayEnabled,
                            onCheckedChange = { v ->
                                if (v) {
                                    if (canDrawOverlays(ctx)) {
                                        vm.setOverlayEnabled(true)
                                        OverlayService.show(ctx)
                                    } else {
                                        ctx.startActivity(
                                            Intent(
                                                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                                Uri.parse("package:${ctx.packageName}")
                                            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        )
                                    }
                                } else {
                                    vm.setOverlayEnabled(false)
                                    OverlayService.hide(ctx)
                                }
                            }
                        )
                    }
                    Text(
                        "他アプリの上に小さな速度パネルを表示します。タップで折りたたみ、ドラッグで移動できます。",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            OutlinedButton(onClick = onOpenAnalysis, modifier = Modifier.fillMaxWidth()) {
                Text("今日の分析を見る")
            }
            OutlinedButton(onClick = onOpenPermissions, modifier = Modifier.fillMaxWidth()) {
                Text("権限の確認")
            }
        }
    }
}

@Composable
private fun LiveStatusCard(snap: com.example.gpsspeedoverlay.service.TrackingState.Snapshot) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                "%.1f km/h".format(snap.currentSpeedKmh),
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "%.2f km ・ %s ・ ±%.0f m".format(
                    snap.distanceMeters / 1000.0,
                    formatElapsed(snap),
                    snap.accuracyMeters
                ),
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(2.dp))
            Text(
                if (snap.isRunning) "● 計測中" else "○ 停止中",
                style = MaterialTheme.typography.bodySmall,
                color = if (snap.isRunning) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

private fun formatElapsed(snap: com.example.gpsspeedoverlay.service.TrackingState.Snapshot): String {
    if (!snap.isRunning || snap.startedAt == 0L) return "00:00"
    val sec = (System.currentTimeMillis() - snap.startedAt) / 1000
    val hh = sec / 3600
    val mm = (sec % 3600) / 60
    val ss = sec % 60
    return if (hh > 0) "%d:%02d:%02d".format(hh, mm, ss) else "%02d:%02d".format(mm, ss)
}

private fun canDrawOverlays(ctx: Context): Boolean = Settings.canDrawOverlays(ctx)
