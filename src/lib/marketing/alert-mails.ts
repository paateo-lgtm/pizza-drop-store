import "server-only";
import { createElement } from "react";
import { NoticeMail } from "@/emails/notice-mail";
import { pizzaCount } from "@/lib/booking/display";
import { formatLongDate, formatTime } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { appUrl } from "@/lib/payment/order-mails";
import {
  CONFIRM_MAIL_KIND,
  type AlertMail,
  type ConfirmMail,
} from "./drop-alert";
import type { FeedbackRequest } from "./feedback";
import type { WaitlistNotice } from "./waitlist";

/** Kein Zeilenumbruch aus Admin-Texten in Kopfzeilen wie dem Betreff */
const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();

const link = (path: string, token: string) =>
  `${appUrl()}${path}?t=${encodeURIComponent(token)}`;

export function sendConfirmMail(mail: ConfirmMail) {
  return sendMail({
    kind: CONFIRM_MAIL_KIND,
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

export function sendWaitlistMail(mail: WaitlistNotice) {
  return sendMail({
    kind: "warteliste",
    to: mail.to,
    dedupeKey: mail.dedupeKey,
    subject: `Slots frei beim Drop „${oneLine(mail.dropTitle)}“`,
    react: createElement(NoticeMail, {
      preview: `Jetzt sind wieder Slots für ${pizzaCount(mail.quantity)} frei.`,
      heading: "Es sind wieder Slots frei",
      paragraphs: [
        `Beim Drop „${mail.dropTitle}“ ist wieder Platz für ${pizzaCount(mail.quantity)} am Stück – gebacken wird am ${formatLongDate(mail.bakeStartsAt)}.`,
        "Wir reservieren nichts vor: Wer zuerst bucht, bekommt die Slots. Wir schreiben dir zu diesem Drop nur dieses eine Mal.",
      ],
      link: `${appUrl()}/drop/${mail.dropSlug}`,
      linkLabel: "Jetzt Abholzeit sichern",
      unsubscribeUrl: link("/warteliste/austragen", mail.leaveToken),
      unsubscribeLabel: "Von der Warteliste austragen",
      footer:
        "Du bekommst diese Mail, weil du dich für diesen Drop auf die Warteliste gesetzt hast.",
    }),
  });
}

export function sendFeedbackMail(mail: FeedbackRequest) {
  const url = `${appUrl()}${mail.feedbackPath}`;
  const [path, query] = mail.feedbackPath.split("?");
  const oneClick = `${appUrl()}/api/feedback/abmelden?o=${encodeURIComponent(mail.orderId)}&${query}`;
  return sendMail({
    kind: "feedback",
    to: mail.to,
    dedupeKey: mail.dedupeKey,
    subject: `Wie war deine Pizza? · Nr. ${mail.orderNumber}`,
    // Widerspruch mit einem Klick direkt im Mailprogramm (RFC 8058)
    headers: {
      "List-Unsubscribe": `<${oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    react: createElement(NoticeMail, {
      preview: "Ein Klick auf die Sterne genügt.",
      heading: "Wie hat es dir geschmeckt?",
      paragraphs: [
        `Danke, dass du beim Drop „${mail.dropTitle}“ dabei warst. Wir backen jedes Mal ein bisschen besser – sag uns kurz, wie deine Pizza war.`,
        "Das dauert keine Minute: 1 bis 5 Sterne und, wenn du magst, ein Satz dazu.",
      ],
      link: url,
      linkLabel: "Jetzt bewerten",
      unsubscribeUrl: `${appUrl()}${path}/abmelden?${query}`,
      unsubscribeLabel: "Keine Feedback-Anfragen mehr",
      footer:
        "Du bekommst diese Mail einmalig, weil du beim Bestellen um eine Bewertungsanfrage gebeten hast.",
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
    subject: `Der Drop „${oneLine(mail.dropTitle)}“ ist offen`,
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
