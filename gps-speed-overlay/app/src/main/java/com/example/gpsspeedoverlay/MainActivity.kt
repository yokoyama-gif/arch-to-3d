package com.example.gpsspeedoverlay

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.gpsspeedoverlay.ui.AnalysisScreen
import com.example.gpsspeedoverlay.ui.MainScreen
import com.example.gpsspeedoverlay.ui.PermissionScreen
import com.example.gpsspeedoverlay.ui.theme.GpsSpeedOverlayTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            GpsSpeedOverlayTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNav()
                }
            }
        }
    }
}

@Composable
private fun AppNav() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = "main") {
        composable("main") {
            MainScreen(
                onOpenAnalysis = { nav.navigate("analysis") },
                onOpenPermissions = { nav.navigate("permissions") }
            )
        }
        composable("analysis") {
            AnalysisScreen(onBack = { nav.popBackStack() })
        }
        composable("permissions") {
            PermissionScreen(onBack = { nav.popBackStack() })
        }
    }
}
