package com.example.gpsspeedoverlay.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "gps_log",
    indices = [Index("session_id"), Index("timestamp")]
)
data class GpsLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @androidx.room.ColumnInfo(name = "session_id") val sessionId: Long,
    val timestamp: Long,
    val latitude: Double,
    val longitude: Double,
    @androidx.room.ColumnInfo(name = "speed_kmh") val speedKmh: Float,
    val accuracy: Float
)
