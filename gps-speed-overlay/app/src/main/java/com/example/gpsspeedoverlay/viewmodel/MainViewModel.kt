package com.example.gpsspeedoverlay.viewmodel

import android.app.Application
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.gpsspeedoverlay.service.TrackingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

private val Application.dataStore by preferencesDataStore("settings")

private val KEY_INTERVAL_MS = longPreferencesKey("interval_ms")

class MainViewModel(app: Application) : AndroidViewModel(app) {

    val tracking: StateFlow<TrackingState.Snapshot> = TrackingState.state

    val intervalMs: StateFlow<Long> = getApplication<Application>().dataStore.data
        .map { it[KEY_INTERVAL_MS] ?: 2000L }
        .stateIn(viewModelScope, SharingStarted.Eagerly, 2000L)

    private val _overlayEnabled = MutableStateFlow(false)
    val overlayEnabled: StateFlow<Boolean> = _overlayEnabled

    fun setIntervalMs(value: Long) {
        viewModelScope.launch {
            getApplication<Application>().dataStore.edit { it[KEY_INTERVAL_MS] = value }
        }
    }

    fun setOverlayEnabled(value: Boolean) {
        _overlayEnabled.value = value
    }
}
