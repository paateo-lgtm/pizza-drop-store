import "server-only";
import { createElement } from "react";
import { OrderMail } from "@/emails/order-mail";
import { orderPath } from "@/lib/booking/order-link";
import { db } from "@/lib/db";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import type { OrderNotice } from "./notify";

/** Absolute Adresse der App für Links in Mails und Stripe. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.NODE_ENV === "production") {
    // Sonst landeten Links samt Schlüssel in Mails und bei Stripe auf localhost.
    throw new Error("APP_URL bzw. VERCEL_PROJECT_PRODUCTION_URL fehlt");
  }
  return "http://localhost:3000";
}

const TEXTS: Record<
  OrderNotice["kind"],
  { subject: string; heading: string; intro: string; code: boolean }
> = {
  confirmed: {
    subject: "Deine Bestellung ist bestätigt",
    heading: "Danke, wir backen für dich!",
    intro:
      "Deine Zahlung ist eingegangen. Zeig zur Abholzeit einfach deinen Abholcode – auf der Bestellseite findest du ihn auch als QR-Code.",
    code: true,
  },
  refunded: {
    subject: "Deine Zahlung wurde erstattet",
    heading: "Leider zu spät – wir erstatten dir alles.",
    intro:
      "Deine Zahlung kam nach Ablauf der Reservierung an, und deine Abholzeit war inzwischen vergeben. Den vollen Betrag haben wir dir erstattet; je nach Bank dauert die Gutschrift ein paar Tage.",
    code: false,
  },
  cancelled: {
    subject: "Deine Bestellung wurde storniert",
    heading: "Deine Bestellung wurde storniert.",
    intro:
      "Wir mussten deine Bestellung leider stornieren. Falls du schon bezahlt hast, erstatten wir dir den vollen Betrag; je nach Bank dauert die Gutschrift ein paar Tage.",
    code: false,
  },
};

/** Kundenmail zu Zahlung oder Storno; pro Anlass und Bestellung genau einmal. */
export async function sendOrderNotice(notice: OrderNotice) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: notice.orderId },
    include: {
      items: true,
      customer: { select: { email: true } },
      drop: { select: { title: true, location: true } },
    },
  });
  const text = TEXTS[notice.kind];
  await sendMail({
    kind: `order-${notice.kind}`,
    to: order.customer.email,
    dedupeKey: `order-${notice.kind}:${order.id}`,
    subject: `${text.subject} · Nr. ${order.number}`,
    react: createElement(OrderMail, {
      preview: text.subject,
      heading: text.heading,
      intro: text.intro,
      orderNumber: order.number,
      dropTitle: order.drop.title,
      pickup: `${formatLongDate(order.pickupAt)}, ${formatTime(order.pickupAt)} Uhr`,
      location: order.drop.location,
      pickupCode: text.code ? order.pickupCode : null,
      items: order.items.map((item) => ({
        label: `${item.quantity} × ${item.nameSnapshot}`,
        price: formatPrice(item.quantity * item.unitPriceCents),
      })),
      total: formatPrice(order.totalCents),
      link: `${appUrl()}${orderPath(order.id)}`,
      linkLabel: "Bestellung ansehen",
    }),
  });
}
