package expo.modules.ahmedsmscapture

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONArray

/** Completion is emitted only from a committed server outcome, never from SMS text. */
internal object SmsCompletionNotifier {
  private const val CHANNEL = "ta3meed-sms-payments"

  @Synchronized fun show(context: Context, owner: String, outcomes: JSONArray) {
    // Share the store monitor with bindUser/disable/capture for the entire read-modify-write.
    // Otherwise an account switch could be overwritten by a stale notification configuration.
    synchronized(SmsCaptureStore) {
    val state = SmsCaptureStore.config(context)
    if (!state.optBoolean("enabled") || state.optString("owner") != owner) return
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "سداد تعميد التلقائي", NotificationManager.IMPORTANCE_HIGH))
    val handled = state.optJSONObject("notifiedPayments") ?: org.json.JSONObject()
    for (i in 0 until outcomes.length()) {
      val outcome = outcomes.optJSONObject(i) ?: continue
      if (outcome.optString("status") !in setOf("applied", "needs_review")) continue
      val content = outcome.optJSONObject("notification") ?: continue
      val id = outcome.optLong("message_id")
      if (id <= 0 || handled.optBoolean(id.toString())) continue
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra("ahmed_sms_message_id", id)
      }
      val builder = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context))
        .setSmallIcon(android.R.drawable.stat_notify_more)
        .setContentTitle(content.optString("title"))
        .setContentText(content.optString("body"))
        .setStyle(Notification.BigTextStyle().bigText(content.optString("body")))
        .setAutoCancel(true).setOnlyAlertOnce(true)
        .setVisibility(Notification.VISIBILITY_PRIVATE)
      if (launch != null) builder.setContentIntent(PendingIntent.getActivity(context, id.hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      // A stable tag also prevents duplicate alerting if the process dies before bookkeeping.
      manager.notify("ta3meed-sms-$owner-$id", 0, builder.build())
      handled.put(id.toString(), true)
      state.put("notifiedPayments", handled)
      SmsCaptureStore.saveConfig(context, state)
    }
    }
  }
}
