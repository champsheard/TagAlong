import * as Contacts from "expo-contacts/legacy";

export type PhoneRecipient = {
  id: string;
  name: string;
  number: string;
  label: string;
};

export class PhoneContactsPermissionError extends Error {
  constructor(readonly canAskAgain: boolean) {
    super(canAskAgain
      ? "Allow contacts access to choose someone to message. You can still share your walk link from the walk screen."
      : "Contacts access is off. Enable it in your phone settings, or share the walk link from the walk screen.");
    this.name = "PhoneContactsPermissionError";
  }
}

export async function readPhoneRecipients(): Promise<PhoneRecipient[]> {
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) throw new PhoneContactsPermissionError(permission.canAskAgain);

  const entries: Contacts.ContactResponse["data"] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
      pageSize: 500,
      pageOffset: offset,
    });
    entries.push(...page.data);
    if (entries.length > 5000) {
      throw new Error("This address book is larger than the 5,000-contact limit.");
    }
    if (!page.hasNextPage) break;
  }

  const recipients = new Map<string, PhoneRecipient>();
  entries.forEach((contact, contactIndex) => {
    const contactId = contact.id ?? `contact-${contactIndex}`;
    (contact.phoneNumbers ?? []).forEach((phone, phoneIndex) => {
      const number = phone.number?.trim();
      if (!number) return;
      const id = `${contactId}-${phoneIndex}`;
      recipients.set(`${contactId}:${number.replace(/[^\d+]/g, "")}`, {
        id,
        name: contact.name?.trim() || "Unnamed contact",
        number,
        label: phone.label?.trim() || "Phone",
      });
    });
  });

  return [...recipients.values()].sort((a, b) => a.name.localeCompare(b.name));
}
