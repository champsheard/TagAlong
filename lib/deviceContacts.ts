import type { DeviceContact } from "../shared/contacts";
export async function readDeviceContacts(_country: string): Promise<DeviceContact[]> {
  throw new Error("Device contact sync is available in the iOS and Android app. You can still share a link from this browser.");
}
