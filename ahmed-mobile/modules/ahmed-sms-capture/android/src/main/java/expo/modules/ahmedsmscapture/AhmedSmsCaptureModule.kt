package expo.modules.ahmedsmscapture

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AhmedSmsCaptureModule : Module() {
  private fun context() = requireNotNull(appContext.reactContext) { "Android context is not ready" }

  override fun definition() = ModuleDefinition {
    Name("AhmedSmsCapture")

    Function("bindUser") { owner: String -> SmsCaptureStore.bindUser(context(), owner); true }
    AsyncFunction("getStatus") { SmsCaptureStore.status(context()) }
    AsyncFunction("enableCapture") { owner: String, token: String, endpoint: String, serverTime: Double, captureFrom: Double ->
      SmsCaptureStore.enable(context(), owner, token, endpoint, serverTime.toLong(), captureFrom.toLong())
      SmsCaptureStore.status(context())
    }
    AsyncFunction("disableCapture") { SmsCaptureStore.disable(context()); SmsCaptureStore.status(context()) }
    AsyncFunction("syncNow") { SmsUploadJob.schedule(context()); SmsCaptureStore.status(context()) }
  }
}
