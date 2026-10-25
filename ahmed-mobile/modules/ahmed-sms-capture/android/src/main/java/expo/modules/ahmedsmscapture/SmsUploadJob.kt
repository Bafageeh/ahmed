package expo.modules.ahmedsmscapture

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SmsUploadJob : JobService() {
  @Volatile private var stopped = false

  override fun onStartJob(params: JobParameters): Boolean {
    stopped = false
    Thread({
      val retry = try { upload(applicationContext) { stopped } } catch (_: Exception) {
        try { SmsCaptureStore.error(applicationContext, "بانتظار الاتصال بالسيرفر لإكمال المزامنة.") } catch (_: Exception) { }
        true
      }
      Handler(Looper.getMainLooper()).post { if (!stopped) jobFinished(params, retry) }
    }, "AhmedSmsUpload").start()
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean { stopped = true; return true }

  companion object {
    private const val JOB_ID = 738151
    private const val RETRY_JOB_ID = 738152

    fun cancel(context: Context) {
      (context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).cancel(JOB_ID)
      (context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).cancel(RETRY_JOB_ID)
    }

    fun schedule(context: Context) {
      val state = SmsCaptureStore.config(context)
      if (!state.optBoolean("enabled") || state.optString("token").isEmpty() || state.optString("owner").isEmpty()) return
      val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
      // A periodic safety net also covers a new arrival racing with an upload's completion.
      if (scheduler.getPendingJob(RETRY_JOB_ID) == null) {
        scheduler.schedule(JobInfo.Builder(RETRY_JOB_ID, ComponentName(context, SmsUploadJob::class.java))
          .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(15 * 60 * 1000L).build())
      }
      // Do not replace an in-flight upload every time another SMS arrives.
      if (scheduler.getPendingJob(JOB_ID) != null) return
      val result = scheduler.schedule(JobInfo.Builder(JOB_ID, ComponentName(context, SmsUploadJob::class.java))
        .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
        .setBackoffCriteria(30_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build())
      if (result != JobScheduler.RESULT_SUCCESS) SmsCaptureStore.error(context, "الرسائل محفوظة محليًا. افتح التطبيق لإعادة محاولة المزامنة.")
    }

    private fun upload(context: Context, cancelled: () -> Boolean): Boolean {
      repeat(100) {
        if (cancelled()) return true
        val state = SmsCaptureStore.config(context)
        val owner = state.optString("owner")
        val token = state.optString("token")
        if (!state.optBoolean("enabled") || owner.isEmpty() || token.isEmpty()) return false
        var payloadBytes = 0
        val messages = SmsCaptureStore.batch(context, owner).takeWhile { message ->
          payloadBytes += message.toString().toByteArray(Charsets.UTF_8).size
          payloadBytes < 1_500_000
        }
        if (messages.isEmpty()) return false
        val connection = URL(state.getString("endpoint")).openConnection() as HttpURLConnection
        try {
          connection.requestMethod = "POST"
          connection.instanceFollowRedirects = false
          connection.connectTimeout = 15_000
          connection.readTimeout = 20_000
          connection.doOutput = true
          connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
          connection.setRequestProperty("Accept", "application/json")
          connection.setRequestProperty("X-Ahmed-SMS-Token", token)
          val current = SmsCaptureStore.config(context)
          if (cancelled() || current.optString("owner") != owner || current.optString("token") != token) return false
          val payload = JSONObject().put("messages", JSONArray(messages)).toString().toByteArray(Charsets.UTF_8)
          connection.setFixedLengthStreamingMode(payload.size)
          connection.outputStream.use { it.write(payload) }
          val code = connection.responseCode
          if (code !in 200..299) {
            SmsCaptureStore.error(context, if (code == 401 || code == 403) "أعد تفعيل استقبال الرسائل لتجديد ربط حسابك." else "الرسائل محفوظة على الجهاز وبانتظار المزامنة.")
            return code != 401 && code != 403 && code != 422
          }
          val response = JSONObject(connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() })
          val acknowledged = response.optJSONArray("accepted_client_ids") ?: return true
          val sent = messages.map { it.getString("client_id") }.toSet()
          val ids = (0 until acknowledged.length()).map { acknowledged.getString(it) }.filter { it in sent }
          if (ids.isEmpty()) return true
          SmsCaptureStore.acknowledge(context, owner, ids)
        } finally { connection.disconnect() }
      }
      return true
    }
  }
}
