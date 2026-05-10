package com.example.gpsspeedoverlay.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF4FC3F7),
    onPrimary = Color(0xFF00344A),
    secondary = Color(0xFF80DEEA),
    background = Color(0xFF0E1116),
    surface = Color(0xFF161A20),
    onBackground = Color(0xFFE6EAF0),
    onSurface = Color(0xFFE6EAF0)
)

private val LightScheme = lightColorScheme(
    primary = Color(0xFF0277BD),
    onPrimary = Color.White,
    secondary = Color(0xFF00838F),
    background = Color(0xFFF6F8FA),
    surface = Color.White
)

@Composable
fun GpsSpeedOverlayTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) DarkScheme else LightScheme
    MaterialTheme(colorScheme = scheme, content = content)
}
