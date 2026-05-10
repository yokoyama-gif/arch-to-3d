package com.example.gpsspeedoverlay.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "session")
data class Session(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @androidx.room.ColumnInfo(name = "started_at") val startedAt: Long,
    @androidx.room.ColumnInfo(name = "ended_at") val endedAt: Long? = null,
    @androidx.room.ColumnInfo(name = "distance_m") val distanceMeters: Double = 0.0,
    @androidx.room.ColumnInfo(name = "max_speed_kmh") val maxSpeedKmh: Float = 0f
)
