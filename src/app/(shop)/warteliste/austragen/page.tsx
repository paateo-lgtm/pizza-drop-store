import type { Metadata } from "next";
import { Suspense } from "react";
import { AlarmPage } from "../../alarm/alarm-page";
import { leaveWaitlistAction } from "../actions";

export const metadata: Metadata = {
  title: "Von der Warteliste austragen",
  robots: { index: false },
};

export default function LeavePage(props: PageProps<"/warteliste/austragen">) {
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
  const page = { eyebrow: "Warteliste" };

  if (status === "left") {
    return (
      <AlarmPage
        {...page}
        title="Du bist ausgetragen."
        text="Wir haben deinen Eintrag gelöscht und schreiben dir zu diesem Drop nichts mehr."
      />
    );
  }
  if (status === "error") {
    return (
      <AlarmPage
        {...page}
        title="Das hat gerade nicht geklappt."
        text="Bitte öffne den Link aus der Mail gleich noch einmal."
      />
    );
  }
  if (status === "invalid" || !token) {
    return (
      <AlarmPage
        {...page}
        title="Dieser Link gilt nicht mehr."
        text="Der Eintrag ist schon gelöscht. Es kommt keine weitere Mail dazu."
      />
    );
  }
  return (
    <AlarmPage
      {...page}
      title="Von der Warteliste austragen?"
      text="Danach löschen wir deinen Eintrag und schreiben dir zu diesem Drop nichts mehr."
      action={leaveWaitlistAction.bind(null, token)}
      buttonLabel="Austragen"
    />
  );
}
