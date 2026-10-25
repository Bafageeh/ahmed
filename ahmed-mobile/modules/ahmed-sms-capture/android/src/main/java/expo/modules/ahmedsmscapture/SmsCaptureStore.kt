package expo.modules.ahmedsmscapture

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** No inbox queries: the only source of message content is a new SMS broadcast. */
internal object SmsCaptureStore {
  private const val KEY_ALIAS = "ahmed.sms.capture.v1"
  private const val CONFIG_FILE = "ahmed-sms-connection.v1"

  @Synchronized private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }

  private fun seal(value: String): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key())
    return Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
  }

  private fun unseal(value: String): String {
    val bytes = Base64.decode(value, Base64.NO_WRAP)
    require(bytes.size > 28)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
    return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
  }

  @Synchronized fun installationId(context: Context): String {
    val path = File(context.noBackupFilesDir, "ahmed-sms-installation.v1")
    if (path.isFile) return path.readText().trim().also { UUID.fromString(it) }
    val value = UUID.randomUUID().toString()
    path.writeText(value)
    return value
  }

  @Synchronized fun config(context: Context): JSONObject {
    val path = File(context.noBackupFilesDir, CONFIG_FILE)
    if (!path.isFile) return JSONObject()
    return JSONObject(unseal(path.readText()))
  }

  @Synchronized fun saveConfig(context: Context, value: JSONObject) {
    val path = File(context.noBackupFilesDir, CONFIG_FILE)
    val temporary = File(context.noBackupFilesDir, "$CONFIG_FILE.tmp")
    temporary.outputStream().use { stream ->
      stream.write(seal(value.toString()).toByteArray(Charsets.UTF_8))
      stream.fd.sync()
    }
    check(temporary.renameTo(path)) { "Could not persist SMS configuration" }
  }

  @Synchronized fun bindUser(context: Context, owner: String) {
    val current = config(context)
    if (current.optString("owner") == owner) return
    // A different login never inherits permission to collect into the previous account.
    saveConfig(context, JSONObject().put("owner", owner).put("enabled", false))
    SmsUploadJob.cancel(context)
  }

  @Synchronized fun enable(context: Context, owner: String, token: String, endpoint: String, serverTime: Long, captureFrom: Long) {
    val state = config(context)
    require(state.optString("owner") == owner && owner.isNotEmpty())
    require(context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED)
    val uri = java.net.URI(endpoint)
    require(uri.scheme == "https" && uri.host == "ahmed.pm.sa" && uri.path == "/api/sms/ingest" && uri.userInfo == null && uri.query == null)
    require(token.length in 40..200 && captureFrom > 0)
    state.put("token", token).put("endpoint", endpoint).put("enabled", true)
      .put("clockOffset", serverTime - System.currentTimeMillis()).put("captureFrom", captureFrom)
      .put("enabledAt", System.currentTimeMillis()).put("lastError", "")
    saveConfig(context, state)
    SmsUploadJob.schedule(context)
  }

  @Synchronized fun disable(context: Context) {
    val state = config(context)
    state.put("enabled", false).remove("token")
    saveConfig(context, state)
    SmsUploadJob.cancel(context)
  }

  private fun database(context: Context): SQLiteDatabase {
    val db = SQLiteDatabase.openOrCreateDatabase(File(context.noBackupFilesDir, "ahmed-sms-queue.v1.db"), null)
    db.execSQL("CREATE TABLE IF NOT EXISTS pending (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, client_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL)")
    db.execSQL("CREATE INDEX IF NOT EXISTS pending_owner ON pending(owner, id)")
    return db
  }

  @Synchronized fun capture(context: Context, sender: String, body: String, sentAt: Long, subscription: Int, slot: Int) {
    val state = config(context)
    val owner = state.optString("owner")
    if (!state.optBoolean("enabled") || owner.isEmpty() || state.optString("token").isEmpty()) return
    val receivedAt = System.currentTimeMillis() + state.optLong("clockOffset")
    if (receivedAt < state.optLong("captureFrom")) return
    val id = UUID.randomUUID().toString()
    val payload = JSONObject().put("client_id", id).put("sender", sender).put("body", body)
      .put("received_at_ms", receivedAt).put("sent_at_ms", if (sentAt > 0) sentAt else JSONObject.NULL)
      .put("subscription_id", if (subscription >= 0) subscription else JSONObject.NULL)
      .put("sim_slot", if (slot >= 0) slot else JSONObject.NULL)
    database(context).use { db ->
      val values = android.content.ContentValues().apply {
        put("owner", owner); put("client_id", id); put("payload", seal(payload.toString()))
      }
      check(db.insertOrThrow("pending", null, values) > 0)
    }
    state.put("lastReceivedAt", receivedAt).put("lastError", "")
    saveConfig(context, state)
  }

  @Synchronized fun batch(context: Context, owner: String): List<JSONObject> = database(context).use { db ->
    db.rawQuery("SELECT payload FROM pending WHERE owner = ? ORDER BY id LIMIT 50", arrayOf(owner)).use { cursor ->
      val result = mutableListOf<JSONObject>()
      while (cursor.moveToNext()) result.add(JSONObject(unseal(cursor.getString(0))))
      result
    }
  }

  @Synchronized fun acknowledge(context: Context, owner: String, ids: List<String>) {
    database(context).use { db ->
      db.beginTransaction()
      try {
        ids.forEach { db.delete("pending", "owner = ? AND client_id = ?", arrayOf(owner, it)) }
        db.setTransactionSuccessful()
      } finally { db.endTransaction() }
    }
    val state = config(context)
    if (state.optString("owner") == owner) {
      state.put("lastUploadedAt", System.currentTimeMillis()).put("lastError", "")
      saveConfig(context, state)
    }
  }

  @Synchronized fun error(context: Context, message: String) {
    val state = config(context)
    state.put("lastError", message)
    saveConfig(context, state)
  }

  @Synchronized fun status(context: Context): Map<String, Any> {
    val state = config(context)
    val count = database(context).use { db ->
      db.rawQuery("SELECT COUNT(*) FROM pending WHERE owner = ?", arrayOf(state.optString("owner"))).use { cursor ->
        cursor.moveToFirst(); cursor.getInt(0)
      }
    }
    return mapOf(
      "enabled" to state.optBoolean("enabled"), "ownerId" to state.optString("owner"),
      "permissionGranted" to (context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED),
      "installationId" to installationId(context), "pendingCount" to count,
      "enabledAt" to state.optLong("enabledAt"), "lastReceivedAt" to state.optLong("lastReceivedAt"),
      "lastUploadedAt" to state.optLong("lastUploadedAt"), "lastError" to state.optString("lastError")
    )
  }
}
