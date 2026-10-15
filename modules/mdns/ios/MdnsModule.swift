import ExpoModulesCore
import Network

public class MdnsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Mdns")

    AsyncFunction("browse") { (type: String, timeoutMs: Int, promise: Promise) in
      // TXT-record browsing needs no per-service resolve; FreeShow puts its IPs in TXT
      let browser = NWBrowser(for: .bonjourWithTXTRecord(type: type, domain: nil), using: NWParameters())
      browser.start(queue: .main)
      DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
        let results: [[String: Any]] = browser.browseResults.compactMap { result in
          guard case let .service(name, _, _, _) = result.endpoint else { return nil }
          var txt: [String: String] = [:]
          if case let .bonjour(record) = result.metadata { txt = record.dictionary }
          return ["name": name, "txt": txt]
        }
        browser.cancel()
        promise.resolve(results)
      }
    }
  }
}
