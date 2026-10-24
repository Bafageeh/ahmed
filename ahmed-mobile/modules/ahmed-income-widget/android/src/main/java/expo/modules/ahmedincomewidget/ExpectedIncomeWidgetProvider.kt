package expo.modules.ahmedincomewidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ExpectedIncomeWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { IncomeWidgetState.render(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    IncomeWidgetState.render(context, manager, id)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    val action = intent.action ?: return
    if (!action.startsWith(IncomeWidgetState.ACTION_PREFIX)) return
    val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    val manager = AppWidgetManager.getInstance(context)
    val info = manager.getAppWidgetInfo(id) ?: return
    if (info.provider != ComponentName(context, ExpectedIncomeWidgetProvider::class.java)) return
    val prefs = context.getSharedPreferences(IncomeWidgetState.STORE, 0)
    when (action) {
      IncomeWidgetState.ACTION_PREFIX + "MONTHLY" -> prefs.edit().putBoolean("annual_$id", false).commit()
      IncomeWidgetState.ACTION_PREFIX + "ANNUAL" -> prefs.edit().putBoolean("annual_$id", true).commit()
      IncomeWidgetState.ACTION_PREFIX + "HIDE" -> prefs.edit().putBoolean("hidden_$id", !prefs.getBoolean("hidden_$id", false)).commit()
      else -> return
    }
    IncomeWidgetState.render(context, manager, id)
  }

  override fun onDeleted(context: Context, ids: IntArray) {
    val editor = context.getSharedPreferences(IncomeWidgetState.STORE, 0).edit()
    ids.forEach { editor.remove("annual_$it").remove("hidden_$it") }
    editor.commit()
  }
}

internal object IncomeWidgetState {
  const val STORE = "ahmed_expected_income_widget_v1"
  const val ACTION_PREFIX = "sa.pm.ahmed.income_widget."

  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    manager.getAppWidgetIds(ComponentName(context, ExpectedIncomeWidgetProvider::class.java))
      .forEach { render(context, manager, it) }
  }

  @Synchronized
  fun render(context: Context, manager: AppWidgetManager, id: Int) {
    val prefs = context.getSharedPreferences(STORE, 0)
    val owner = prefs.getString("owner", "").orEmpty()
    val snapshot = runCatching { JSONObject(prefs.getString("snapshot", "{}").orEmpty()) }.getOrDefault(JSONObject())
    val ready = owner.isNotEmpty() && snapshot.optString("ownerId") == owner && snapshot.optLong("updatedAt") > 0
    val annual = prefs.getBoolean("annual_$id", false)
    val hidden = prefs.getBoolean("hidden_$id", false)
    val options = manager.getAppWidgetOptions(id)
    val compact = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 220) < 220
    val narrow = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320) < 290
    val views = RemoteViews(context.packageName, R.layout.ahmed_income_widget)
    val money = NumberFormat.getNumberInstance(Locale.US).apply { minimumFractionDigits = 2; maximumFractionDigits = 2 }
    val amount = snapshot.optDouble(if (annual) "annualAmount" else "monthlyAmount", 0.0)

    views.setTextViewText(R.id.income_widget_title, if (annual) "التقدير السنوي" else "إجمالي الدخل الشهري")
    views.setTextViewText(R.id.income_widget_amount, when { !ready -> "—"; hidden -> "••••••"; else -> snapshot.optString(if (annual) "annualText" else "monthlyText", money.format(amount)) })
    views.setTextViewTextSize(R.id.income_widget_amount, TypedValue.COMPLEX_UNIT_SP, if (narrow) 28f else 36f)
    views.setTextViewText(R.id.income_widget_hint, when {
      owner.isEmpty() -> "افتح تطبيق أحمد وسجّل الدخول"
      !ready -> "افتح الدخل المستقبلي لمزامنة المصادر"
      snapshot.optBoolean("stale") -> "بعض المصادر لم تُحدّث"
      annual -> "تقدير سنوي من مصادر دخلك الحالية"
      else -> "نظرة موحّدة على مصادر دخلك المستقبلية"
    })
    views.setTextViewText(R.id.income_widget_count, if (ready) "${snapshot.optInt("activeCount")} مصدر نشط" else "الدخل المتوقع")
    val updated = if (ready) SimpleDateFormat("h:mm a", Locale("ar", "SA")).format(Date(snapshot.optLong("updatedAt"))) else ""
    views.setTextViewText(R.id.income_widget_updated, if (ready) "آخر تحديث $updated" else "بانتظار المزامنة")
    views.setViewVisibility(R.id.income_widget_hint, if (compact && ready) View.GONE else View.VISIBLE)
    views.setImageViewResource(R.id.income_widget_eye, if (hidden) R.drawable.ahmed_income_eye_off else R.drawable.ahmed_income_eye)
    views.setContentDescription(R.id.income_widget_eye, if (hidden) "إظهار المبلغ" else "إخفاء المبلغ")
    views.setInt(R.id.income_widget_monthly, "setBackgroundResource", if (!annual) R.drawable.ahmed_income_selected else R.drawable.ahmed_income_unselected)
    views.setInt(R.id.income_widget_annual, "setBackgroundResource", if (annual) R.drawable.ahmed_income_selected else R.drawable.ahmed_income_unselected)
    views.setTextColor(R.id.income_widget_monthly, Color.parseColor(if (!annual) "#174F46" else "#B7D2C9"))
    views.setTextColor(R.id.income_widget_annual, Color.parseColor(if (annual) "#174F46" else "#B7D2C9"))
    views.setOnClickPendingIntent(R.id.income_widget_monthly, action(context, id, "MONTHLY"))
    views.setOnClickPendingIntent(R.id.income_widget_annual, action(context, id, "ANNUAL"))
    views.setOnClickPendingIntent(R.id.income_widget_eye, action(context, id, "HIDE"))

    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    if (launch != null) {
      launch.action = Intent.ACTION_VIEW
      launch.data = Uri.parse("ahmed://future-income")
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      views.setOnClickPendingIntent(R.id.income_widget_root, PendingIntent.getActivity(context, id, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }

    val bitmap = Bitmap.createBitmap(900, 18, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.parseColor("#355D59")
    canvas.drawRect(0f, 0f, 900f, 18f, paint)
    if (ready) {
      val segments = snapshot.optJSONArray("segments")
      var x = 0f
      if (segments != null) for (index in 0 until segments.length()) {
        val segment = segments.optJSONObject(index) ?: continue
        val fraction = segment.optDouble("fraction", 0.0).coerceIn(0.0, 1.0).toFloat()
        val end = (x + fraction * 900f).coerceAtMost(900f)
        paint.color = runCatching { Color.parseColor(segment.optString("color")) }.getOrDefault(Color.parseColor("#58736F"))
        canvas.drawRect(x, 0f, end, 18f, paint)
        if (x > 0f) { paint.color = Color.parseColor("#183D3A"); canvas.drawRect(x, 0f, (x + 5f).coerceAtMost(end), 18f, paint) }
        x = end
      }
    }
    views.setImageViewBitmap(R.id.income_widget_bar, bitmap)
    manager.updateAppWidget(id, views)
  }

  private fun action(context: Context, id: Int, action: String): PendingIntent {
    val intent = Intent(context, ExpectedIncomeWidgetProvider::class.java).apply {
      this.action = ACTION_PREFIX + action
      data = Uri.parse("ahmed-widget://income/$id/$action")
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
    }
    return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
