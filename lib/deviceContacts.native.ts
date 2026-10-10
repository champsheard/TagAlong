import * as Contacts from "expo-contacts/legacy";
import * as Crypto from "expo-crypto";
import { getCountries } from "libphonenumber-js/min";
import { canonicalIdentifier, normalizeIdentifier, type DeviceContact } from "../shared/contacts";

export async function readDeviceContacts(country: string): Promise<DeviceContact[]> {
  if (!getCountries().includes(country.toUpperCase() as any)) throw new Error("Enter a valid two-letter country code, such as US or GB.");
  const permission = await Contacts.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Contacts permission was denied. You can still share a link with anyone. Enable contacts access in phone settings to sync.");
  const contacts: Contacts.ContactResponse["data"] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails], pageSize: 500, pageOffset: offset });
    contacts.push(...page.data);
    if (contacts.length > 5000) throw new Error("This address book is larger than the 5,000-contact sync limit. Grant access to a smaller selection of contacts.");
    if (!page.hasNextPage) break;
  }
  const canonical = new Map<string, string>();
  const prepared = contacts.map((contact, index) => {
    const keys = [
      ...(contact.phoneNumbers ?? []).map(n => { const p = normalizeIdentifier("phone", n.number ?? "", country); return p ? canonicalIdentifier("phone", p) : null; }),
      ...(contact.emails ?? []).map(e => { const email = normalizeIdentifier("email", e.email ?? ""); return email ? canonicalIdentifier("email", email) : null; }),
    ].filter((v): v is string => !!v);
    keys.forEach(k => canonical.set(k, ""));
    return {
      id: contact.id ?? `contact-${index}`,
      name: contact.name || "Unnamed contact",
      keys,
      phoneNumbers: (contact.phoneNumbers ?? []).flatMap(phone => {
        const number = phone.number?.trim();
        return number ? [{ number, label: phone.label || "Phone" }] : [];
      }),
      emails: (contact.emails ?? []).flatMap(entry => {
        const email = entry.email?.trim();
        return email ? [email] : [];
      }),
    };
  });
  const keys = [...canonical.keys()];
  for (let i = 0; i < keys.length; i += 100) {
    await Promise.all(keys.slice(i, i + 100).map(async k => canonical.set(k, await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, k))));
  }
  return prepared.map(c => ({
    id: c.id,
    name: c.name,
    hashes: [...new Set(c.keys.map(k => canonical.get(k)!))],
    installationIds: [],
    notificationsEnabled: false,
    phoneNumbers: c.phoneNumbers,
    emails: c.emails,
  }));
}
