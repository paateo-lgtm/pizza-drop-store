import type { Metadata } from "next";
import { Suspense } from "react";
import { verifyFeedbackKey } from "@/lib/booking/order-link";
import { db } from "@/lib/db";
import { feedbackState } from "@/lib/domain/feedback";
import { AlarmPage } from "../../alarm/alarm-page";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = {
  title: "Bewertung",
  robots: { index: false },
};

export default function FeedbackPage(props: PageProps<"/feedback/[id]">) {
  return (
    <Suspense>
      <Content params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/feedback/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const query = await searchParams;
  const key = typeof query.k === "string" ? query.k : "";
  const order = verifyFeedbackKey(id, key)
    ? await db.order.findUnique({
        where: { id },
        select: {
          number: true,
          status: true,
          pickedUpAt: true,
          drop: { select: { title: true } },
          feedback: { select: { id: true } },
        },
      })
    : null;
  const page = { eyebrow: "Bewertung" };

  if (!order) {
    return (
      <AlarmPage
        {...page}
        title="Dieser Link gilt nicht."
        text="Bitte öffne den Link noch einmal direkt aus der Mail."
      />
    );
  }
  const state = feedbackState(
    { ...order, hasFeedback: order.feedback !== null },
    new Date(),
  );
  if (state === "done") {
    return (
      <AlarmPage
        {...page}
        title="Danke, deine Bewertung ist da."
        text="Für diese Bestellung haben wir sie schon bekommen."
      />
    );
  }
  if (state === "closed") {
    return (
      <AlarmPage
        {...page}
        title="Die Bewertung ist geschlossen."
        text="Für diese Bestellung nehmen wir keine Bewertung mehr an."
      />
    );
  }
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-10 pb-20 sm:px-8">
      <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
        Bewertung · Bestellung {order.number}
      </p>
      <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
        Wie war deine Pizza?
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        Vom Drop „{order.drop.title}“.
      </p>
      <FeedbackForm orderId={id} feedbackKey={key} />
    </div>
  );
}
