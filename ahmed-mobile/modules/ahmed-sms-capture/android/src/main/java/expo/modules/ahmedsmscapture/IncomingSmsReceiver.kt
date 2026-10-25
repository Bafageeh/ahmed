package expo.modules.ahmedsmscapture

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class IncomingSmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    // Save synchronously before the broadcast completes; uploading is a separate job.
    try {
      val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
      val subscription = intent.getIntExtra("subscription", -1)
      val slot = intent.getIntExtra("slot", -1)
      parts.groupBy { it.originatingAddress ?: "" }.values.forEach { group ->
        val first = group.first()
        SmsCaptureStore.capture(context, first.originatingAddress ?: "", group.joinToString("") { it.messageBody ?: "" }, first.timestampMillis, subscription, slot)
      }
      SmsUploadJob.schedule(context)
    } catch (_: Exception) {
      try { SmsCaptureStore.error(context, "تعذر حفظ الرسالة على الجهاز. تحقق من مساحة التخزين.") } catch (_: Exception) { }
    }
  }
}

class SmsRestartReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED)) return
    try { SmsUploadJob.schedule(context) } catch (_: Exception) { }
  }
}
