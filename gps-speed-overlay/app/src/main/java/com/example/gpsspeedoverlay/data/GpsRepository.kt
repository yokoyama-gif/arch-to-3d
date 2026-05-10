package com.example.gpsspeedoverlay.data

import android.content.Context
import java.util.Calendar
import java.util.TimeZone

class GpsRepository(context: Context) {

    private val db = AppDatabase.get(context)
    private val logDao = db.gpsLogDao()
    private val sessionDao = db.sessionDao()

    suspend fun startSession(now: Long = System.currentTimeMillis()): Long =
        sessionDao.insert(Session(startedAt = now))

    suspend fun finishSession(id: Long, distanceMeters: Double, maxSpeedKmh: Float) {
        sessionDao.finishSession(id, System.currentTimeMillis(), distanceMeters, maxSpeedKmh)
    }

    suspend fun getActiveSession(): Session? = sessionDao.getActiveSession()

    suspend fun appendLog(log: GpsLog) {
        logDao.insert(log)
    }

    suspend fun getLogsForSession(id: Long): List<GpsLog> = logDao.getLogsForSession(id)

    suspend fun summaryForToday(): DailySummary {
        val (start, end) = todayBoundsMillis()
        val avg = logDao.getAverageSpeedBetween(start, end) ?: 0f
        val max = logDao.getMaxSpeedBetween(start, end) ?: 0f
        val sessions = sessionDao.getSessionsBetween(start, end)
        val distance = sessions.sumOf { it.distanceMeters }
        val movingMs = sessions.sumOf { (it.endedAt ?: System.currentTimeMillis()) - it.startedAt }
        return DailySummary(avg, max, distance, movingMs)
    }

    suspend fun hourlyForToday(): List<HourlySpeed> {
        val (start, end) = todayBoundsMillis()
        val tzOffsetSeconds = TimeZone.getDefault().getOffset(start) / 1000L
        return logDao.getHourlySpeedBetween(start, end, tzOffsetSeconds)
    }

    private fun todayBoundsMillis(): Pair<Long, Long> {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val start = cal.timeInMillis
        cal.add(Calendar.DAY_OF_MONTH, 1)
        val end = cal.timeInMillis - 1
        return start to end
    }
}

data class DailySummary(
    val averageSpeedKmh: Float,
    val maxSpeedKmh: Float,
    val distanceMeters: Double,
    val movingMillis: Long
)
