package church.freeplay.mdns

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MdnsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Mdns")

    AsyncFunction("browse") { type: String, timeoutMs: Int, promise: Promise ->
      val context = appContext.reactContext ?: return@AsyncFunction promise.reject("E_MDNS", "No React context", null)
      val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
      val handler = Handler(Looper.getMainLooper())
      val pending = ArrayDeque<NsdServiceInfo>()
      val results = mutableListOf<Map<String, Any?>>()
      var resolving = false

      // NsdManager only resolves one service at a time before API 34
      fun resolveNext() {
        if (resolving || pending.isEmpty()) return
        resolving = true
        nsd.resolveService(pending.removeFirst(), object : NsdManager.ResolveListener {
          override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
            handler.post { resolving = false; resolveNext() }
          }

          override fun onServiceResolved(info: NsdServiceInfo) {
            handler.post {
              results.add(mapOf(
                "name" to info.serviceName,
                "host" to info.host?.hostAddress,
                "txt" to info.attributes.mapValues { (_, value) -> value?.toString(Charsets.UTF_8) ?: "" }
              ))
              resolving = false
              resolveNext()
            }
          }
        })
      }

      val listener = object : NsdManager.DiscoveryListener {
        override fun onDiscoveryStarted(serviceType: String) {}
        override fun onDiscoveryStopped(serviceType: String) {}
        override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
        override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
        override fun onServiceLost(info: NsdServiceInfo) {}
        override fun onServiceFound(info: NsdServiceInfo) {
          handler.post { pending.addLast(info); resolveNext() }
        }
      }

      nsd.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener)
      handler.postDelayed({
        try { nsd.stopServiceDiscovery(listener) } catch (_: Exception) {}
        promise.resolve(results.toList())
      }, timeoutMs.toLong())
    }
  }
}
