package com.example.gpsspeedoverlay.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.gpsspeedoverlay.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Owns a single WindowManager view that floats above other apps. The view
 * supports drag-to-move and tap-to-collapse so it doesn't crowd the Uber Eats
 * driver UI. State is read from [TrackingState], not from the location service
 * directly — keeps this service decoupled from the GPS subscription.
 */
class OverlayService : Service() {

    companion object {
        private const val CHANNEL_ID = "gps_overlay"
        private const val NOTIFICATION_ID = 1002
        const val ACTION_SHOW = "com.example.gpsspeedoverlay.OVERLAY_SHOW"
        const val ACTION_HIDE = "com.example.gpsspeedoverlay.OVERLAY_HIDE"

        fun show(context: Context) {
            val intent = Intent(context, OverlayService::class.java).apply { action = ACTION_SHOW }
            ContextCompat.startForegroundService(context, intent)
        }

        fun hide(context: Context) {
            val intent = Intent(context, OverlayService::class.java).apply { action = ACTION_HIDE }
            context.startService(intent)
        }
    }

    private val scope = CoroutineScope(Dispatchers.Main)
    private var collectJob: Job? = null
    private lateinit var windowManager: WindowManager
    private var rootView: LinearLayout? = null
    private var speedText: TextView? = null
    private var detailText: TextView? = null
    private var collapsed = false

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_HIDE -> {
                stopOverlay()
                return START_NOT_STICKY
            }
            else -> {
                startInForeground()
                showOverlay()
            }
        }
        return START_STICKY
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun showOverlay() {
        if (rootView != null) return

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(12)
            y = dp(120)
            // Slightly transparent so it doesn't fully obscure the map below.
            alpha = 0.78f
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(Color.parseColor("#CC101418"))
                setStroke(dp(1), Color.parseColor("#3399EE"))
            }
            setPadding(dp(14), dp(10), dp(14), dp(10))
        }

        val speed = TextView(this).apply {
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
            text = "-- km/h"
            includeFontPadding = false
        }
        val detail = TextView(this).apply {
            setTextColor(Color.parseColor("#B8E0FF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            text = "0.00 km ・ 00:00"
            includeFontPadding = false
        }
        container.addView(speed)
        container.addView(detail)

        speedText = speed
        detailText = detail
        rootView = container

        attachDragAndCollapse(container, params)

        windowManager.addView(container, params)

        collectJob = scope.launch {
            TrackingState.state.collect { snap ->
                renderSnapshot(snap)
            }
        }
    }

    private fun renderSnapshot(snap: TrackingState.Snapshot) {
        val speedStr = if (snap.isRunning) "%.1f km/h".format(snap.currentSpeedKmh)
        else "-- km/h"
        speedText?.text = if (collapsed) speedStr.substringBefore(" ") else speedStr

        if (collapsed) {
            detailText?.visibility = View.GONE
            return
        }
        detailText?.visibility = View.VISIBLE

        val km = snap.distanceMeters / 1000.0
        val elapsedMs = if (snap.isRunning && snap.startedAt > 0)
            System.currentTimeMillis() - snap.startedAt else 0L
        val totalSec = elapsedMs / 1000
        val hh = totalSec / 3600
        val mm = (totalSec % 3600) / 60
        val ss = totalSec % 60
        val timeStr = if (hh > 0) "%d:%02d:%02d".format(hh, mm, ss)
        else "%02d:%02d".format(mm, ss)
        val acc = if (snap.accuracyMeters > 0) " ・ ±%.0fm".format(snap.accuracyMeters) else ""
        detailText?.text = "%.2f km ・ %s%s".format(km, timeStr, acc)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun attachDragAndCollapse(view: View, params: WindowManager.LayoutParams) {
        var startX = 0
        var startY = 0
        var touchX = 0f
        var touchY = 0f
        var isDrag = false
        val touchSlop = dp(6)

        view.setOnTouchListener { _, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = params.x
                    startY = params.y
                    touchX = e.rawX
                    touchY = e.rawY
                    isDrag = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (e.rawX - touchX).toInt()
                    val dy = (e.rawY - touchY).toInt()
                    if (!isDrag && (abs(dx) > touchSlop || abs(dy) > touchSlop)) {
                        isDrag = true
                    }
                    if (isDrag) {
                        params.x = startX + dx
                        params.y = startY + dy
                        try { windowManager.updateViewLayout(view, params) } catch (_: Throwable) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDrag) toggleCollapsed()
                    true
                }
                else -> false
            }
        }
    }

    private fun toggleCollapsed() {
        collapsed = !collapsed
        renderSnapshot(TrackingState.state.value)
    }

    private fun stopOverlay() {
        collectJob?.cancel()
        rootView?.let { runCatching { windowManager.removeView(it) } }
        rootView = null
        speedText = null
        detailText = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startInForeground() {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("オーバーレイ表示中")
            .setContentText("速度オーバーレイを表示しています")
            .setSmallIcon(R.drawable.ic_speed)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "オーバーレイ",
            NotificationManager.IMPORTANCE_MIN
        ).apply { setShowBadge(false) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun dp(v: Int): Int =
        (v * resources.displayMetrics.density).toInt()

    override fun onBind(intent: Intent?): IBinder? = null
}
