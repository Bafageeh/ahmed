package expo.modules.ahmedincomewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class AhmedIncomeWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AhmedIncomeWidget")

    Function("bindSession") { ownerId: String ->
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences(IncomeWidgetState.STORE, 0)
      synchronized(IncomeWidgetState) {
        if (prefs.getString("owner", "") != ownerId || ownerId.isEmpty()) {
          prefs.edit().putString("owner", ownerId).remove("snapshot").commit()
        }
      }
      IncomeWidgetState.updateAll(context)
      true
    }

    Function("updateSnapshot") { ownerId: String, serialized: String ->
      val context = appContext.reactContext ?: return@Function false
      val snapshot = JSONObject(serialized)
      if (snapshot.optString("ownerId") != ownerId || ownerId.isEmpty()) return@Function false
      val prefs = context.getSharedPreferences(IncomeWidgetState.STORE, 0)
      val accepted = synchronized(IncomeWidgetState) {
        if (prefs.getString("owner", "") != ownerId) false
        else prefs.edit().putString("snapshot", snapshot.toString()).commit()
      }
      if (accepted) IncomeWidgetState.updateAll(context)
      accepted
    }

    Function("hasWidgets") {
      val context = appContext.reactContext ?: return@Function false
      AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, ExpectedIncomeWidgetProvider::class.java)).isNotEmpty()
    }

    AsyncFunction("requestPin") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@AsyncFunction false
      manager.requestPinAppWidget(ComponentName(context, ExpectedIncomeWidgetProvider::class.java), null, null)
    }
  }
}
