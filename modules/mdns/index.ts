import { requireNativeModule } from "expo";

export interface MdnsService {
  name: string;
  host?: string | null;
  txt?: Record<string, string>;
}

const Mdns = requireNativeModule<{ browse(type: string, timeoutMs: number): Promise<MdnsService[]> }>("Mdns");

/** Browse a DNS-SD service type (e.g. "_freeshow._udp") for timeoutMs and return what was found. */
export const browse = (type: string, timeoutMs: number) => Mdns.browse(type, timeoutMs);
