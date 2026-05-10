package com.example.gpsspeedoverlay.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.gpsspeedoverlay.data.DailySummary
import com.example.gpsspeedoverlay.data.GpsRepository
import com.example.gpsspeedoverlay.data.HourlySpeed
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AnalysisViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = GpsRepository(app)

    private val _summary = MutableStateFlow(DailySummary(0f, 0f, 0.0, 0L))
    val summary: StateFlow<DailySummary> = _summary

    private val _hourly = MutableStateFlow<List<HourlySpeed>>(emptyList())
    val hourly: StateFlow<List<HourlySpeed>> = _hourly

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _summary.value = repo.summaryForToday()
            _hourly.value = repo.hourlyForToday()
        }
    }
}
