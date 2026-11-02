import type { Metadata } from "next";
import { Suspense } from "react";
import { AlarmPage } from "../../../alarm/alarm-page";
import { withdrawConsent } from "../../actions";

export const metadata: Metadata = {
  title: "Keine Feedback-Anfragen mehr",
  robots: { index: false },
};

export default function WithdrawPage(
  props: PageProps<"/feedback/[id]/abmelden">,
) {
  return (
    <Suspense>
      <Content params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/feedback/[id]/abmelden">, "params" | "searchParams">) {
  const { id } = await params;
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : null;
  const key = typeof query.k === "string" ? query.k : null;
  const page = { eyebrow: "Bewertung" };

  if (status === "withdrawn") {
    return (
      <AlarmPage
        {...page}
        title="Erledigt."
        text="Wir fragen dich nach keiner Bestellung mehr nach einer Bewertung. Beim nächsten Bestellen kannst du es wieder ankreuzen."
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
  if (status === "invalid" || !key) {
    return (
      <AlarmPage
        {...page}
        title="Dieser Link gilt nicht."
        text="Bitte öffne den Link noch einmal direkt aus der Mail oder antworte einfach darauf."
      />
    );
  }
  return (
    <AlarmPage
      {...page}
      title="Keine Feedback-Anfragen mehr?"
      text="Danach schicken wir dir nach deinen Bestellungen keine Bitte um Bewertung mehr."
      action={withdrawConsent.bind(null, id, key)}
      buttonLabel="Keine Anfragen mehr"
    />
  );
}
