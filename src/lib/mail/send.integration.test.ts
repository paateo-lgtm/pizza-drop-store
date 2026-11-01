import { createElement } from "react";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { MAIL_SKIPPED, sendMail } from "./send";

const RUN = `p4m-${Date.now().toString(36)}`;
const mail = (key: string) => ({
  kind: "test",
  to: "kunde@pizzadrop.test",
  dedupeKey: `${RUN}:${key}`,
  subject: "Test",
  react: createElement("p", null, "Hallo"),
});

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
});

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { dedupeKey: { startsWith: RUN } } });
  await db.$disconnect();
});

describe("sendMail", () => {
  it("vermerkt ohne Schlüssel „nicht gesendet“ und versucht es beim nächsten Mal erneut", async () => {
    expect(await sendMail(mail("a"))).toBe("skipped");
    const row = await db.emailLog.findUniqueOrThrow({
      where: { dedupeKey: `${RUN}:a` },
    });
    expect(row.providerId).toBe(MAIL_SKIPPED);
    // Nicht für immer gesperrt: ein späterer Versuch übernimmt den Eintrag
    expect(await sendMail(mail("a"))).toBe("skipped");
  });

  it("verschickt eine gelungene Mail kein zweites Mal", async () => {
    await db.emailLog.create({
      data: {
        kind: "test",
        to: "kunde@pizzadrop.test",
        dedupeKey: `${RUN}:b`,
        providerId: "re_123",
      },
    });
    expect(await sendMail(mail("b"))).toBe("duplicate");
  });

  it("überlässt einen laufenden Versand dem ersten, einen hängengebliebenen nicht", async () => {
    await db.emailLog.create({
      data: { kind: "test", to: "x@pizzadrop.test", dedupeKey: `${RUN}:c` },
    });
    expect(await sendMail(mail("c"))).toBe("duplicate");

    await db.emailLog.create({
      data: {
        kind: "test",
        to: "x@pizzadrop.test",
        dedupeKey: `${RUN}:d`,
        createdAt: new Date(Date.now() - 11 * 60_000),
      },
    });
    expect(await sendMail(mail("d"))).toBe("skipped");
  });
});
