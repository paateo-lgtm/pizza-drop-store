import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { orderPath } from "@/lib/booking/order-link";
import { db } from "@/lib/db";
import { cancellationFor } from "@/lib/domain/payment";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { PageHeader, PageSkeleton } from "../../_components/page-header";
import { MAIL_FAILED, MAIL_SKIPPED } from "@/lib/mail/send";
import { CancelOrder } from "../cancel-order";
import { OrderStatusBadge } from "../order-status-badge";
import { ResendMail } from "../resend-mail";

export const metadata: Metadata = { title: "Bestellung" };

const MAIL_LABELS: Record<string, string> = {
  "order-confirmed": "Bestätigung",
  "order-refunded": "Erstattung",
  "order-cancelled": "Storno",
};

const dateTime = (date: Date) =>
  `${formatLongDate(date)}, ${formatTime(date)} Uhr`;

export default function OrderDetailPage(
  props: PageProps<"/admin/bestellungen/[id]">,
) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Bestellung" />
          <PageSkeleton rows={6} />
        </>
      }
    >
      <OrderDetail params={props.params} />
    </Suspense>
  );
}

async function OrderDetail({
  params,
}: Pick<PageProps<"/admin/bestellungen/[id]">, "params">) {
  const user = await requireUser("orders:view");
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      customer: { select: { email: true } },
      drop: { select: { id: true, title: true } },
      slots: { orderBy: { seq: "asc" }, select: { seq: true, startsAt: true } },
      refunds: { orderBy: { createdAt: "asc" } },
      coupon: { select: { id: true, code: true } },
    },
  });
  if (!order) notFound();

  const mails = await db.emailLog.findMany({
    where: {
      dedupeKey: {
        in: ["confirmed", "refunded", "cancelled"].map(
          (kind) => `order-${kind}:${order.id}`,
        ),
      },
    },
    orderBy: { createdAt: "asc" },
    select: { kind: true, providerId: true, createdAt: true },
  });

  const now = new Date();
  const expired = order.status === "PENDING_PAYMENT" && order.expiresAt <= now;
  const plan = expired ? null : cancellationFor(order.status);
  const canManage = can(user.role, "orders:manage");
  const canCancel = plan !== null && canManage;

  const facts: [string, React.ReactNode][] = [
    ["Abholung", dateTime(order.pickupAt)],
    [
      "Slots",
      order.slots.length > 0
        ? `${order.slots.map((s) => s.seq).join(", ")} · ab ${formatTime(order.slots[0].startsAt)}`
        : "–",
    ],
    [
      "Abholcode",
      <span key="code" className="font-mono tracking-widest">
        {order.pickupCode}
      </span>,
    ],
    ["Bestellt", dateTime(order.createdAt)],
    ["Bezahlt", order.paidAt ? dateTime(order.paidAt) : "–"],
    ["Feedback-Mail", order.feedbackConsent ? "erwünscht" : "nein"],
  ];

  return (
    <>
      <Link
        href="/admin/bestellungen"
        className="-mt-4 mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Alle Bestellungen
      </Link>
      <PageHeader
        title={`Bestellung ${order.number}`}
        description={`${order.drop.title} · ${order.customerName}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={orderPath(order.id)}
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm hover:bg-wash"
            >
              <ExternalLink className="size-4" aria-hidden /> Kundenansicht
            </Link>
            {canCancel && (
              <CancelOrder
                orderId={order.id}
                number={order.number}
                refund={plan.refund}
                amount={formatPrice(order.totalCents)}
              />
            )}
          </div>
        }
      />
      <div className="-mt-4 mb-8">
        <OrderStatusBadge status={order.status} expired={expired} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <section className="flex flex-col gap-6">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-ink-muted">{label}</dt>
                <dd className="mt-0.5 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h2 className="border-b border-line pb-2 text-2xl">Positionen</h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-2.5">
                  <span>
                    {item.quantity} × {item.nameSnapshot}
                  </span>
                  <span className="tabular-nums">
                    {formatPrice(item.quantity * item.unitPriceCents)}
                  </span>
                </li>
              ))}
            </ul>
            {order.discountCents > 0 && (
              <p className="flex justify-between pb-2.5 text-ink-muted">
                <span>
                  Gutschein{" "}
                  {order.coupon ? (
                    <Link
                      href={`/admin/gutscheine/${order.coupon.id}`}
                      className="font-mono underline underline-offset-4"
                    >
                      {order.coupon.code}
                    </Link>
                  ) : (
                    "(gelöscht)"
                  )}
                </span>
                <span className="tabular-nums">
                  −{formatPrice(order.discountCents)}
                </span>
              </p>
            )}
            <p className="flex justify-between border-t border-line pt-2.5 font-semibold">
              <span>Summe</span>
              <span className="tabular-nums">
                {formatPrice(order.totalCents)}
              </span>
            </p>
          </div>

          {order.note && (
            <div>
              <h2 className="text-sm text-ink-muted">Notiz des Kunden</h2>
              <p className="mt-1 rounded-md bg-wash px-3 py-2">{order.note}</p>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-8 text-sm">
          <section className="flex flex-col gap-2">
            <h2 className="border-b border-line pb-2 text-2xl">Kontakt</h2>
            <p>{order.customerName}</p>
            <a
              className="underline-offset-4 hover:underline"
              href={`tel:${order.customerPhone}`}
            >
              {order.customerPhone}
            </a>
            <a
              className="break-all underline-offset-4 hover:underline"
              href={`mailto:${order.customer.email}`}
            >
              {order.customer.email}
            </a>
          </section>
          {mails.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="border-b border-line pb-2 text-2xl">Mails</h2>
              <ul className="flex flex-col gap-2">
                {mails.map((mail) => {
                  const failed =
                    mail.providerId === MAIL_FAILED ||
                    mail.providerId === MAIL_SKIPPED;
                  return (
                    <li
                      key={mail.kind}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span>{MAIL_LABELS[mail.kind] ?? mail.kind}</span>
                      <span
                        className={
                          failed ? "text-terracotta" : "text-ink-muted"
                        }
                      >
                        {mail.providerId === MAIL_FAILED
                          ? "fehlgeschlagen"
                          : mail.providerId === MAIL_SKIPPED
                            ? "nicht gesendet (kein Mail-Schlüssel)"
                            : mail.providerId
                              ? `gesendet ${formatTime(mail.createdAt)}`
                              : "wird gesendet"}
                      </span>
                      {failed && canManage && (
                        <ResendMail orderId={order.id} kind={mail.kind} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {order.refunds.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="border-b border-line pb-2 text-2xl">
                Erstattungen
              </h2>
              <ul className="flex flex-col gap-2">
                {order.refunds.map((refund) => (
                  <li key={refund.id}>
                    <span className="font-medium tabular-nums">
                      {formatPrice(refund.amountCents)}
                    </span>{" "}
                    <span className="text-ink-muted">
                      · {dateTime(refund.createdAt)}
                      {refund.reason && ` · ${refund.reason}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Link
            href={`/admin/drops/${order.drop.id}`}
            className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Zum Drop „{order.drop.title}“
          </Link>
        </aside>
      </div>
    </>
  );
}
