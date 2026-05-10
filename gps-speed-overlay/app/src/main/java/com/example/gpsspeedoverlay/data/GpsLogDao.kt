package com.example.gpsspeedoverlay.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Aggregated speed for one hour-of-day bucket (0-23) for a given day range.
 */
data class HourlySpeed(
    val hour: Int,
    @androidx.room.ColumnInfo(name = "avg_speed") val avgSpeedKmh: Float,
    @androidx.room.ColumnInfo(name = "max_speed") val maxSpeedKmh: Float,
    @androidx.room.ColumnInfo(name = "sample_count") val sampleCount: Int
)

@Dao
interface GpsLogDao {

    @Insert
    suspend fun insert(log: GpsLog): Long

    @Insert
    suspend fun insertAll(logs: List<GpsLog>)

    @Query("SELECT * FROM gps_log WHERE session_id = :sessionId ORDER BY timestamp ASC")
    suspend fun getLogsForSession(sessionId: Long): List<GpsLog>

    @Query("SELECT * FROM gps_log WHERE timestamp BETWEEN :startMs AND :endMs ORDER BY timestamp ASC")
    suspend fun getLogsBetween(startMs: Long, endMs: Long): List<GpsLog>

    @Query("SELECT MAX(speed_kmh) FROM gps_log WHERE timestamp BETWEEN :startMs AND :endMs")
    suspend fun getMaxSpeedBetween(startMs: Long, endMs: Long): Float?

    @Query("SELECT AVG(speed_kmh) FROM gps_log WHERE timestamp BETWEEN :startMs AND :endMs AND speed_kmh > 0")
    suspend fun getAverageSpeedBetween(startMs: Long, endMs: Long): Float?

    @Query("SELECT COUNT(*) FROM gps_log WHERE timestamp BETWEEN :startMs AND :endMs")
    fun observeCountBetween(startMs: Long, endMs: Long): Flow<Int>

    /**
     * Hour-of-day bucket aggregation. We use SQLite strftime against the local timezone
     * by shifting the unix-ms timestamp into seconds, applying the device's UTC offset
     * (passed in from the caller as `tzOffsetSeconds`), and then bucketing by hour.
     */
    @Query(
        """
        SELECT
            CAST(((timestamp / 1000 + :tzOffsetSeconds) % 86400) / 3600 AS INTEGER) AS hour,
            AVG(speed_kmh) AS avg_speed,
            MAX(speed_kmh) AS max_speed,
            COUNT(*) AS sample_count
        FROM gps_log
        WHERE timestamp BETWEEN :startMs AND :endMs
        GROUP BY hour
        ORDER BY hour ASC
        """
    )
    suspend fun getHourlySpeedBetween(
        startMs: Long,
        endMs: Long,
        tzOffsetSeconds: Long
    ): List<HourlySpeed>
}
