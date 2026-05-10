package com.example.gpsspeedoverlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.gpsspeedoverlay.data.HourlySpeed
import com.example.gpsspeedoverlay.ui.components.SpeedBarChart
import com.example.gpsspeedoverlay.viewmodel.AnalysisViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalysisScreen(
    onBack: () -> Unit,
    vm: AnalysisViewModel = viewModel()
) {
    val summary by vm.summary.collectAsState()
    val hourly by vm.hourly.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("今日の分析") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                },
                actions = {
                    IconButton(onClick = vm::refresh) {
                        Icon(Icons.Default.Refresh, contentDescription = "更新")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            SummaryCard(
                avg = summary.averageSpeedKmh,
                max = summary.maxSpeedKmh,
                distanceMeters = summary.distanceMeters,
                movingMillis = summary.movingMillis
            )
            ChartCard(hourly)
            HourBandCard(hourly)
        }
    }
}

@Composable
private fun SummaryCard(avg: Float, max: Float, distanceMeters: Double, movingMillis: Long) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("サマリー", style = MaterialTheme.typography.titleMedium)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Stat("平均速度", "%.1f km/h".format(avg))
                Stat("最高速度", "%.1f km/h".format(max))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Stat("走行距離", "%.2f km".format(distanceMeters / 1000.0))
                Stat("走行時間", formatMillis(movingMillis))
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Text(value, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ChartCard(data: List<HourlySpeed>) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("時間別 平均速度（棒グラフ）", style = MaterialTheme.typography.titleMedium)
            Text(
                "オレンジの線は最高速度。横軸は0〜24時。",
                style = MaterialTheme.typography.bodySmall
            )
            SpeedBarChart(data = data, modifier = Modifier.padding(top = 8.dp))
        }
    }
}

@Composable
private fun HourBandCard(data: List<HourlySpeed>) {
    val byHour = data.associateBy { it.hour }
    val ceiling = ((data.maxOfOrNull { it.maxSpeedKmh } ?: 30f).coerceAtLeast(20f))
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("時間帯ごとの帯", style = MaterialTheme.typography.titleMedium)
            Text(
                "色が濃いほど平均速度が高い時間帯。サンプルが無い時間は空白。",
                style = MaterialTheme.typography.bodySmall
            )
            Row(modifier = Modifier.padding(top = 12.dp)) {
                for (h in 0 until 24) {
                    val v = byHour[h]?.avgSpeedKmh ?: 0f
                    val frac = (v / ceiling).coerceIn(0f, 1f)
                    val alpha = if (v > 0f) 0.25f + frac * 0.75f else 0.05f
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 1.dp)
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = alpha))
                            .padding(vertical = 14.dp)
                    ) {}
                }
            }
            Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
                listOf(0, 3, 6, 9, 12, 15, 18, 21, 24).forEach { h ->
                    Text(
                        "$h",
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

private fun formatMillis(ms: Long): String {
    val sec = ms / 1000
    val hh = sec / 3600
    val mm = (sec % 3600) / 60
    return if (hh > 0) "%d時間 %d分".format(hh, mm) else "%d分".format(mm)
}
