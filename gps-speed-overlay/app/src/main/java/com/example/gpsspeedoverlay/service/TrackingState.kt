package com.example.gpsspeedoverlay.service

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Process-wide singleton that exposes the live state of the tracking session
 * to the UI (Compose) and the overlay (WindowManager view).
 *
 * We use a singleton (not a bound service) because the same numbers are read
 * from at least three places — Activity, Overlay window, notification — and
 * binding all three to a Service would add a lot of plumbing for no gain.
 */
object TrackingState {

    data class Snapshot(
        val isRunning: Boolean = false,
        val sessionId: Long? = null,
        val startedAt: Long = 0L,
        val currentSpeedKmh: Float = 0f,    // 5-second average
        val instantSpeedKmh: Float = 0f,    // most recent sample
        val maxSpeedKmh: Float = 0f,
        val distanceMeters: Double = 0.0,
        val accuracyMeters: Float = 0f,
        val lastFixAt: Long = 0L
    )

    private val _state = MutableStateFlow(Snapshot())
    val state: StateFlow<Snapshot> = _state.asStateFlow()

    fun update(transform: (Snapshot) -> Snapshot) {
        _state.value = transform(_state.value)
    }

    fun reset() {
        _state.value = Snapshot()
    }
}
