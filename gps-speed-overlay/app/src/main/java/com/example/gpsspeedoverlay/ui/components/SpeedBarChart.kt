package com.example.gpsspeedoverlay.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.gpsspeedoverlay.data.HourlySpeed

private val gridLineColor = Color(0x22FFFFFF)
private val axisColor = Color(0x55FFFFFF)
private val barBrush = Brush.verticalGradient(
    listOf(Color(0xFF4FC3F7), Color(0xFF0277BD))
)
private val maxBarColor = Color(0xFFFFB74D)
private val labelHours = listOf(0, 3, 6, 9, 12, 15, 18, 21, 24)

/**
 * Bar chart of average kmh per hour-of-day (24 buckets), with a thin marker
 * for each bucket's max speed. Drawn entirely with Canvas so we don't need
 * to pull in MPAndroidChart or Vico.
 */
@Composable
fun SpeedBarChart(
    data: List<HourlySpeed>,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val labelStyle = TextStyle(color = Color.White.copy(alpha = 0.75f), fontSize = 10.sp)
    val ceilingKmh = (data.maxOfOrNull { it.maxSpeedKmh } ?: 50f).coerceAtLeast(20f)
    val niceCeiling = niceCeiling(ceilingKmh)

    val byHour = data.associateBy { it.hour }

    Box(modifier = modifier
        .fillMaxWidth()
        .height(220.dp)) {
        Canvas(Modifier.fillMaxWidth().height(220.dp)) {
            val padLeft = with(density) { 32.dp.toPx() }
            val padRight = with(density) { 8.dp.toPx() }
            val padTop = with(density) { 12.dp.toPx() }
            val padBottom = with(density) { 22.dp.toPx() }

            val plotWidth = size.width - padLeft - padRight
            val plotHeight = size.height - padTop - padBottom

            // Horizontal grid + Y labels (0, 25, 50, 75, 100% of niceCeiling).
            for (i in 0..4) {
                val frac = i / 4f
                val y = padTop + plotHeight * (1f - frac)
                drawLine(
                    color = gridLineColor,
                    start = Offset(padLeft, y),
                    end = Offset(size.width - padRight, y),
                    strokeWidth = 1f
                )
                val value = (niceCeiling * frac).toInt()
                val layout = measurer.measure("$value", labelStyle)
                drawText(
                    textLayoutResult = layout,
                    topLeft = Offset(padLeft - layout.size.width - with(density) { 4.dp.toPx() }, y - layout.size.height / 2)
                )
            }

            // Bars: 24 hour buckets.
            val slotWidth = plotWidth / 24f
            val barWidth = slotWidth * 0.72f
            for (h in 0 until 24) {
                val bucket = byHour[h] ?: continue
                val avgFrac = (bucket.avgSpeedKmh / niceCeiling).coerceIn(0f, 1f)
                val maxFrac = (bucket.maxSpeedKmh / niceCeiling).coerceIn(0f, 1f)
                val barH = plotHeight * avgFrac
                val left = padLeft + slotWidth * h + (slotWidth - barWidth) / 2f
                val top = padTop + plotHeight - barH
                drawRect(
                    brush = barBrush,
                    topLeft = Offset(left, top),
                    size = Size(barWidth, barH)
                )
                // Max speed marker — short horizontal tick.
                val maxY = padTop + plotHeight - plotHeight * maxFrac
                drawLine(
                    color = maxBarColor,
                    start = Offset(left, maxY),
                    end = Offset(left + barWidth, maxY),
                    strokeWidth = with(density) { 2.dp.toPx() }
                )
            }

            // X-axis baseline.
            drawLine(
                color = axisColor,
                start = Offset(padLeft, padTop + plotHeight),
                end = Offset(size.width - padRight, padTop + plotHeight),
                strokeWidth = 1.5f
            )

            // Hour labels at 0/3/6/9/12/15/18/21/24.
            for (h in labelHours) {
                val x = padLeft + slotWidth * h
                drawLine(
                    color = axisColor,
                    start = Offset(x, padTop + plotHeight),
                    end = Offset(x, padTop + plotHeight + with(density) { 4.dp.toPx() }),
                    strokeWidth = 1f
                )
                val layout = measurer.measure("%d".format(h), labelStyle)
                drawText(
                    textLayoutResult = layout,
                    topLeft = Offset(x - layout.size.width / 2f, padTop + plotHeight + with(density) { 6.dp.toPx() })
                )
            }

            // Border around the plot so 0% bars still feel like a chart.
            drawRect(
                color = axisColor,
                topLeft = Offset(padLeft, padTop),
                size = Size(plotWidth, plotHeight),
                style = Stroke(width = 1f)
            )
        }
    }
}

/**
 * Round the y-axis ceiling up to a "nice" number — 20, 30, 40, 60, 80, 100, …
 * so the chart isn't cropped at oddly-precise values like 47.3 km/h.
 */
private fun niceCeiling(v: Float): Float {
    val candidates = floatArrayOf(20f, 30f, 40f, 60f, 80f, 100f, 120f, 150f, 200f)
    return candidates.firstOrNull { it >= v } ?: 200f
}
