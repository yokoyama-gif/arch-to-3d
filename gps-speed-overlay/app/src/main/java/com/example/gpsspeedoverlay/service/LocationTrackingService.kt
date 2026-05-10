package com.example.gpsspeedoverlay.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.gpsspeedoverlay.MainActivity
import com.example.gpsspeedoverlay.R
import com.example.gpsspeedoverlay.data.GpsLog
import com.example.gpsspeedoverlay.data.GpsRepository
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Foreground service that owns the GPS subscription. It writes raw fixes to
 * Room and pushes a smoothed snapshot into [TrackingState] so the UI and the
 * overlay can read it without binding.
 */
class LocationTrackingService : Service() {

    companion object {
        private const val TAG = "LocationTracking"
        private const val CHANNEL_ID = "gps_tracking"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.example.gpsspeedoverlay.START"
        const val ACTION_STOP = "com.example.gpsspeedoverlay.STOP"
        const val EXTRA_INTERVAL_MS = "interval_ms"

        // GPS quality gates. Numbers chosen empirically for delivery scooters:
        // urban canyons frequently report >50m accuracy, and >130 km/h is almost
        // certainly a multipath jump rather than a real reading.
        private const val MAX_ACCURACY_METERS = 50f
        private const val MAX_PLAUSIBLE_SPEED_KMH = 130f

        // Sliding window for the displayed "current speed" (5 seconds per spec).
        private const val SMOOTHING_WINDOW_MS = 5_000L

        fun start(context: Context, intervalMs: Long = 2000L) {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_INTERVAL_MS, intervalMs)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var repo: GpsRepository
    private val client by lazy { LocationServices.getFusedLocationProviderClient(this) }
    private val notifications by lazy { getSystemService(NotificationManager::class.java) }
    private var wakeLock: PowerManager.WakeLock? = null

    private var sessionId: Long = -1L
    private var sessionStart: Long = 0L
    private var lastLocation: Location? = null
    private var distanceMeters: Double = 0.0
    private var maxSpeedKmh: Float = 0f
    private val recentSamples = ArrayDeque<Pair<Long, Float>>() // (timestamp, kmh)
    private var notificationJob: Job? = null

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            for (loc in result.locations) handleLocation(loc)
        }
    }

    override fun onCreate() {
        super.onCreate()
        repo = GpsRepository(applicationContext)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTracking()
                return START_NOT_STICKY
            }
            ACTION_START, null -> startTracking(
                intent?.getLongExtra(EXTRA_INTERVAL_MS, 2000L) ?: 2000L
            )
        }
        return START_STICKY
    }

    private fun startTracking(intervalMs: Long) {
        if (sessionId != -1L) return // already running

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Missing location permission, stopping.")
            stopSelf()
            return
        }

        startInForeground(currentSpeedKmh = 0f)

        // Hold a partial wakelock so 1-3s GPS updates keep flowing while the
        // device dozes during a long delivery shift. The user explicitly chose
        // accuracy over battery in the spec.
        wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "gps:tracking").apply {
                setReferenceCounted(false)
                acquire(/* timeout */ 12 * 60 * 60 * 1000L)
            }

        sessionStart = System.currentTimeMillis()
        scope.launch {
            sessionId = repo.startSession(sessionStart)
            TrackingState.update {
                it.copy(
                    isRunning = true,
                    sessionId = sessionId,
                    startedAt = sessionStart,
                    currentSpeedKmh = 0f,
                    instantSpeedKmh = 0f,
                    maxSpeedKmh = 0f,
                    distanceMeters = 0.0,
                    accuracyMeters = 0f
                )
            }
        }

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs.coerceAtLeast(1000L))
            .setWaitForAccurateLocation(false)
            .build()

        try {
            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        } catch (se: SecurityException) {
            Log.e(TAG, "requestLocationUpdates denied", se)
            stopSelf()
        }
    }

    private fun stopTracking() {
        client.removeLocationUpdates(callback)
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
        notificationJob?.cancel()

        val finalSessionId = sessionId
        val finalDistance = distanceMeters
        val finalMax = maxSpeedKmh
        sessionId = -1L
        lastLocation = null
        distanceMeters = 0.0
        maxSpeedKmh = 0f
        recentSamples.clear()

        scope.launch {
            if (finalSessionId != -1L) {
                repo.finishSession(finalSessionId, finalDistance, finalMax)
            }
            TrackingState.reset()
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun handleLocation(loc: Location) {
        // Reject low-quality fixes outright.
        if (!loc.hasAccuracy() || loc.accuracy > MAX_ACCURACY_METERS) return

        val instantKmh = if (loc.hasSpeed()) loc.speed * 3.6f else 0f
        if (instantKmh > MAX_PLAUSIBLE_SPEED_KMH) return

        val previous = lastLocation
        lastLocation = loc
        if (previous != null) {
            // Only count distance when we are actually moving — drops the GPS
            // creep that happens while parked.
            val delta = previous.distanceTo(loc)
            if (delta in 1f..200f && instantKmh > 1f) {
                distanceMeters += delta
            }
        }

        if (instantKmh > maxSpeedKmh) maxSpeedKmh = instantKmh

        val now = System.currentTimeMillis()
        recentSamples.addLast(now to instantKmh)
        while (recentSamples.isNotEmpty() && now - recentSamples.first().first > SMOOTHING_WINDOW_MS) {
            recentSamples.removeFirst()
        }
        val smoothed = if (recentSamples.isEmpty()) 0f
        else recentSamples.sumOf { it.second.toDouble() }.toFloat() / recentSamples.size

        TrackingState.update {
            it.copy(
                currentSpeedKmh = smoothed,
                instantSpeedKmh = instantKmh,
                maxSpeedKmh = maxSpeedKmh,
                distanceMeters = distanceMeters,
                accuracyMeters = loc.accuracy,
                lastFixAt = now
            )
        }

        val sid = sessionId
        if (sid != -1L) {
            scope.launch {
                repo.appendLog(
                    GpsLog(
                        sessionId = sid,
                        timestamp = now,
                        latitude = loc.latitude,
                        longitude = loc.longitude,
                        speedKmh = instantKmh,
                        accuracy = loc.accuracy
                    )
                )
            }
        }

        // Throttle notification refresh to ~once per second.
        if (notificationJob?.isActive != true) {
            notificationJob = scope.launch {
                kotlinx.coroutines.delay(750)
                notifications?.notify(NOTIFICATION_ID, buildNotification(smoothed))
            }
        }
    }

    private fun startInForeground(currentSpeedKmh: Float) {
        val notification = buildNotification(currentSpeedKmh)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(currentSpeedKmh: Float): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, LocationTrackingService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val text = "現在 %.1f km/h ・ %.2f km".format(
            currentSpeedKmh,
            distanceMeters / 1000.0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GPS計測中")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_speed)
            .setContentIntent(openIntent)
            .addAction(0, "停止", stopIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "GPSトラッキング",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "計測中に常駐通知を表示します"
            setShowBadge(false)
        }
        notifications.createNotificationChannel(channel)
    }

    override fun onDestroy() {
        scope.cancel()
        wakeLock?.takeIf { it.isHeld }?.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
