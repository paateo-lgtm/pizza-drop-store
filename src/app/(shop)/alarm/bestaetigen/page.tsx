import type { Metadata } from "next";
import { Suspense } from "react";
import { confirmAlert } from "../actions";
import { AlarmPage } from "../alarm-page";

export const metadata: Metadata = {
  title: "Drop-Alarm bestätigen",
  robots: { index: false },
};

export default function ConfirmPage(props: PageProps<"/alarm/bestaetigen">) {
  return (
    <Suspense>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : null;
  const token = typeof query.t === "string" ? query.t : null;

  if (status === "confirmed" || status === "already") {
    return (
      <AlarmPage
        title="Du bist dabei."
        text="Sobald der nächste Drop in den Verkauf geht, bekommst du eine Mail. Abmelden kannst du dich mit dem Link in jeder Mail."
      />
    );
  }
  if (status === "error") {
    return (
      <AlarmPage
        title="Das hat gerade nicht geklappt."
        text="Bitte öffne den Link aus der Mail gleich noch einmal."
      />
    );
  }
  if (status === "invalid" || !token) {
    return (
      <AlarmPage
        title="Dieser Link gilt nicht mehr."
        text="Vielleicht hast du dich inzwischen ab- und neu angemeldet. Trag dich auf der Startseite einfach noch einmal ein."
      />
    );
  }
  // Bestätigen per Knopf, nicht schon beim Öffnen: Mail-Scanner öffnen Links automatisch.
  return (
    <AlarmPage
      title="Drop-Alarm bestätigen"
      text="Wir schreiben dir, sobald ein neuer Pizza-Drop in den Verkauf geht – sonst nichts."
      action={confirmAlert.bind(null, token)}
      buttonLabel="Ja, Drop-Alarm einschalten"
    />
  );
}
