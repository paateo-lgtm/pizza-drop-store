import type { Metadata } from "next";
import { Suspense } from "react";
import { unsubscribeAlert } from "../actions";
import { AlarmPage } from "../alarm-page";

export const metadata: Metadata = {
  title: "Vom Drop-Alarm abmelden",
  robots: { index: false },
};

export default function UnsubscribePage(props: PageProps<"/alarm/abmelden">) {
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

  if (status === "unsubscribed") {
    return (
      <AlarmPage
        title="Du bist abgemeldet."
        text="Du bekommst keinen Drop-Alarm mehr. Schade – auf der Startseite kannst du dich jederzeit wieder eintragen."
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
        text="Falls du weiter Mails bekommst, nutze den Abmeldelink in der neuesten Mail oder antworte einfach darauf."
      />
    );
  }
  return (
    <AlarmPage
      title="Vom Drop-Alarm abmelden?"
      text="Danach bekommst du keine Mails mehr, wenn ein neuer Drop startet."
      action={unsubscribeAlert.bind(null, token)}
      buttonLabel="Abmelden"
    />
  );
}
