import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  LegalPage,
  LegalPending,
  OperatorAddress,
} from "@/components/legal-page";
import { isLegalComplete } from "@/lib/content/schema";
import { getContent } from "@/lib/content/store";

export const metadata: Metadata = { title: "Impressum" };

export default function ImprintPage() {
  return (
    <LegalPage title="Impressum">
      <Suspense>
        <Imprint />
      </Suspense>
    </LegalPage>
  );
}

async function Imprint() {
  await connection();
  const legal = await getContent("legal");
  if (!isLegalComplete(legal)) return <LegalPending />;
  return (
    <>
      <h2>Angaben gemäß § 5 DDG</h2>
      <OperatorAddress legal={legal} />
      {legal.vatId && (
        <>
          <h2>Umsatzsteuer</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {legal.vatId}
          </p>
        </>
      )}
      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        {legal.responsible || legal.operatorName}, Anschrift wie oben (§ 18 Abs.
        2 MStV).
      </p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungs­
        verfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </>
  );
}
