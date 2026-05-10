package com.example.gpsspeedoverlay.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update

@Dao
interface SessionDao {

    @Insert
    suspend fun insert(session: Session): Long

    @Update
    suspend fun update(session: Session)

    @Query("SELECT * FROM session WHERE id = :id")
    suspend fun getById(id: Long): Session?

    @Query("SELECT * FROM session WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1")
    suspend fun getActiveSession(): Session?

    @Query("SELECT * FROM session WHERE started_at BETWEEN :startMs AND :endMs ORDER BY started_at ASC")
    suspend fun getSessionsBetween(startMs: Long, endMs: Long): List<Session>

    @Query("UPDATE session SET ended_at = :endedAt, distance_m = :distanceMeters, max_speed_kmh = :maxSpeedKmh WHERE id = :id")
    suspend fun finishSession(id: Long, endedAt: Long, distanceMeters: Double, maxSpeedKmh: Float)
}
