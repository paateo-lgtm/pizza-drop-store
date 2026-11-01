import "server-only";
import { createElement } from "react";
import { NoticeMail } from "@/emails/notice-mail";
import { formatLongDate, formatTime } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { appUrl } from "@/lib/payment/order-mails";
import type { AlertMail, ConfirmMail } from "./drop-alert";

const link = (path: string, token: string) =>
  `${appUrl()}${path}?t=${encodeURIComponent(token)}`;

export function sendConfirmMail(mail: ConfirmMail) {
  return sendMail({
    kind: "drop-alarm-bestaetigen",
    to: mail.to,
    dedupeKey: mail.dedupeKey,
    subject: "Bitte bestätige deinen Drop-Alarm",
    react: createElement(NoticeMail, {
      preview:
        "Ein Klick, dann sagen wir dir Bescheid, wenn der nächste Drop startet.",
      heading: "Fast geschafft",
      paragraphs: [
        "Du möchtest Bescheid bekommen, sobald ein neuer Pizza-Drop in den Verkauf geht. Bitte bestätige das mit einem Klick.",
        "Warst du das nicht? Dann ignoriere diese Mail einfach – ohne Bestätigung schreiben wir dir nichts.",
      ],
      link: link("/alarm/bestaetigen", mail.token),
      linkLabel: "Drop-Alarm bestätigen",
      footer:
        "Du bekommst diese Mail, weil diese Adresse auf pizza-drop für den Drop-Alarm eingetragen wurde.",
    }),
  });
}

export function sendAlertMail(mail: AlertMail) {
  const unsubscribeUrl = link("/alarm/abmelden", mail.unsubscribeToken);
  const oneClick = link("/api/alarm/abmelden", mail.unsubscribeToken);
  return sendMail({
    kind: "drop-alarm",
    to: mail.to,
    dedupeKey: mail.dedupeKey,
    subject: `Der Drop „${mail.dropTitle}“ ist offen`,
    // Abmelden mit einem Klick direkt im Mailprogramm (RFC 8058)
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    react: createElement(NoticeMail, {
      preview: `Jetzt Abholzeit sichern – ${formatLongDate(mail.bakeStartsAt)}.`,
      heading: `${mail.dropTitle} ist offen`,
      paragraphs: [
        `Gebacken wird am ${formatLongDate(mail.bakeStartsAt)} von ${formatTime(mail.bakeStartsAt)} bis ${formatTime(mail.bakeEndsAt)} Uhr. Jede Pizza hat ihren eigenen Slot im Ofen – wer zuerst bucht, wählt die Abholzeit.`,
        `Der Verkauf läuft bis ${formatLongDate(mail.saleEndsAt)}, ${formatTime(mail.saleEndsAt)} Uhr, solange Slots frei sind.`,
      ],
      link: `${appUrl()}/drop/${mail.dropSlug}`,
      linkLabel: "Abholzeit sichern",
      unsubscribeUrl,
      footer: "Du bekommst diese Mail, weil du den Drop-Alarm bestätigt hast.",
    }),
  });
}
