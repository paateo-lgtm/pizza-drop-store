import { describe, expect, it } from "vitest";
import {
  averageBakeSeconds,
  canFinishTicket,
  canPickUp,
  canStartTicket,
  delaySeconds,
  kitchenQueue,
  laterTimeline,
  nextBlockableSlot,
  orderStatusFromTickets,
  slotLengthHint,
  type KitchenTicket,
} from "./kitchen";

const SLOT = 360; // 6 Minuten
const START = new Date("2026-11-06T17:00:00Z").getTime();
const at = (minutes: number, seconds = 0) =>
  new Date(START + minutes * 60_000 + seconds * 1000);

/** Ticket im Slot `seq` (1-basiert) des Rasters ab 17:00. */
function ticket(
  seq: number,
  status: KitchenTicket["status"],
  times: { oven?: Date; done?: Date } = {},
): KitchenTicket {
  return {
    id: `t${seq}`,
    seq,
    status,
    slotStartsAt: at((seq - 1) * 6),
    slotEndsAt: at(seq * 6),
    ovenStartedAt: times.oven ?? null,
    doneAt: times.done ?? null,
  };
}

describe("kitchenQueue", () => {
  it("teilt die Tickets in Ofen, Als Nächstes, Danach und Fertig, in Slot-Reihenfolge", () => {
    const tickets = [
      ticket(4, "QUEUED"),
      ticket(1, "DONE", { oven: at(0), done: at(6) }),
      ticket(3, "QUEUED"),
      ticket(2, "OVEN", { oven: at(6) }),
    ];
    const queue = kitchenQueue(tickets);
    expect(queue.current?.id).toBe("t2");
    expect(queue.next?.id).toBe("t3");
    expect(queue.later.map((t) => t.id)).toEqual(["t4"]);
    expect(queue.done.map((t) => t.id)).toEqual(["t1"]);
  });

  it("kommt ohne Tickets und ohne Ofen aus", () => {
    expect(kitchenQueue([])).toEqual({
      current: null,
      next: null,
      later: [],
      done: [],
    });
    const queue = kitchenQueue([ticket(1, "QUEUED")]);
    expect(queue.current).toBeNull();
    expect(queue.next?.id).toBe("t1");
  });
});

describe("canStartTicket", () => {
  it("lässt nur die nächste Pizza in den Ofen, solange der Ofen leer ist", () => {
    const tickets = [ticket(1, "QUEUED"), ticket(2, "QUEUED")];
    expect(canStartTicket("t1", tickets)).toBe(true);
    expect(canStartTicket("t2", tickets)).toBe(false);
  });

  it("verbietet eine zweite Pizza im Ofen", () => {
    const tickets = [ticket(1, "OVEN", { oven: at(0) }), ticket(2, "QUEUED")];
    expect(canStartTicket("t2", tickets)).toBe(false);
  });

  it("verbietet fertige, laufende und unbekannte Tickets", () => {
    const tickets = [
      ticket(1, "DONE", { oven: at(0), done: at(6) }),
      ticket(2, "QUEUED"),
    ];
    expect(canStartTicket("t1", tickets)).toBe(false);
    expect(canStartTicket("gibt-es-nicht", tickets)).toBe(false);
  });
});

describe("canFinishTicket", () => {
  it("erlaubt „Fertig“ nur für die Pizza im Ofen", () => {
    const tickets = [ticket(1, "OVEN", { oven: at(0) }), ticket(2, "QUEUED")];
    expect(canFinishTicket("t1", tickets)).toBe(true);
    expect(canFinishTicket("t2", tickets)).toBe(false);
    expect(canFinishTicket("gibt-es-nicht", tickets)).toBe(false);
  });
});

describe("delaySeconds", () => {
  it("ist im Plan, wenn die Pizza im Ofen rechtzeitig fertig wird", () => {
    const tickets = [ticket(1, "OVEN", { oven: at(0) }), ticket(2, "QUEUED")];
    expect(delaySeconds(tickets, SLOT, at(3))).toBe(0);
  });

  it("rechnet mit dem späten Ofenstart der aktuellen Pizza", () => {
    // Slot 1 endet 17:06, die Pizza kam erst 17:02:30 in den Ofen → Ende 17:08:30
    const tickets = [ticket(1, "OVEN", { oven: at(2, 30) })];
    expect(delaySeconds(tickets, SLOT, at(3))).toBe(150);
  });

  it("wächst weiter, wenn die Pizza über die Zeit im Ofen bleibt", () => {
    const tickets = [ticket(1, "OVEN", { oven: at(0) })];
    expect(delaySeconds(tickets, SLOT, at(8))).toBe(120);
  });

  it("rechnet bei leerem Ofen so, als käme die nächste Pizza jetzt hinein", () => {
    const tickets = [
      ticket(1, "DONE", { oven: at(0), done: at(6) }),
      ticket(2, "QUEUED"),
    ];
    // Slot 2 endet 17:12; jetzt 17:08 → Ende 17:14
    expect(delaySeconds(tickets, SLOT, at(8))).toBe(120);
    expect(delaySeconds(tickets, SLOT, at(5))).toBe(0);
  });

  it("baut Verzug über freie Slots ab", () => {
    // Nächste Pizza erst in Slot 4 (endet 17:24); jetzt 17:10 → Ende 17:16, also im Plan
    const tickets = [
      ticket(1, "DONE", { oven: at(0), done: at(9) }),
      ticket(4, "QUEUED"),
    ];
    expect(delaySeconds(tickets, SLOT, at(10))).toBe(0);
  });

  it("ist 0, wenn nichts mehr zu backen ist", () => {
    expect(delaySeconds([], SLOT, at(0))).toBe(0);
    expect(
      delaySeconds(
        [ticket(1, "DONE", { oven: at(0), done: at(20) })],
        SLOT,
        at(30),
      ),
    ).toBe(0);
  });
});

describe("averageBakeSeconds", () => {
  it("mittelt die gemessenen Ofenzeiten fertiger Pizzen", () => {
    const tickets = [
      ticket(1, "DONE", { oven: at(0), done: at(5) }),
      ticket(2, "DONE", { oven: at(6), done: at(11, 40) }),
      ticket(3, "OVEN", { oven: at(12) }),
    ];
    expect(averageBakeSeconds(tickets)).toEqual({ seconds: 320, count: 2 });
  });

  it("ist leer, solange keine Pizza fertig ist", () => {
    expect(averageBakeSeconds([ticket(1, "OVEN", { oven: at(0) })])).toBe(null);
  });
});

describe("slotLengthHint", () => {
  it("schlägt ab drei Messungen eine auf 30 s aufgerundete Slotlänge vor", () => {
    expect(slotLengthHint({ seconds: 320, count: 3 }, SLOT)).toBe(330);
    expect(slotLengthHint({ seconds: 400, count: 5 }, SLOT)).toBe(420);
  });

  it("schweigt bei wenigen Messungen oder kleiner Abweichung", () => {
    expect(slotLengthHint({ seconds: 300, count: 2 }, SLOT)).toBeNull();
    expect(slotLengthHint({ seconds: 340, count: 10 }, SLOT)).toBeNull();
    expect(slotLengthHint(null, SLOT)).toBeNull();
  });
});

describe("orderStatusFromTickets", () => {
  it("ist bezahlt, solange keine Pizza im Ofen war", () => {
    expect(orderStatusFromTickets(["QUEUED", "QUEUED"])).toBe("PAID");
  });

  it("ist in Arbeit, sobald eine Pizza im Ofen ist oder fertig, aber nicht alle", () => {
    expect(orderStatusFromTickets(["OVEN", "QUEUED"])).toBe("IN_PROGRESS");
    expect(orderStatusFromTickets(["DONE", "QUEUED"])).toBe("IN_PROGRESS");
  });

  it("ist abholbereit, wenn alle Pizzen fertig sind", () => {
    expect(orderStatusFromTickets(["DONE", "DONE"])).toBe("READY");
  });
});

describe("canPickUp", () => {
  it("gibt nur abholbereite Bestellungen aus", () => {
    expect(canPickUp("READY")).toBe(true);
    for (const status of [
      "PAID",
      "IN_PROGRESS",
      "PICKED_UP",
      "REFUNDED",
    ] as const) {
      expect(canPickUp(status)).toBe(false);
    }
  });
});

describe("laterTimeline", () => {
  const slot = (seq: number, ticketId: string | null) => ({
    seq,
    startsAt: at((seq - 1) * 6),
    ticketId,
  });

  it("zeigt Tickets nach dem nächsten und fasst Lücken zusammen", () => {
    const slots = [
      slot(1, "t1"),
      slot(2, "t2"),
      slot(3, null),
      slot(4, null),
      slot(5, "t5"),
      slot(6, null),
    ];
    expect(laterTimeline(slots, 2)).toEqual([
      { kind: "gap", startsAt: at(12), count: 2 },
      { kind: "ticket", ticketId: "t5", startsAt: at(24) },
      { kind: "gap", startsAt: at(30), count: 1 },
    ]);
  });

  it("begrenzt die Liste auf die nächsten Einträge", () => {
    const slots = Array.from({ length: 20 }, (_, i) =>
      slot(i + 1, `t${i + 1}`),
    );
    expect(laterTimeline(slots, 0, 3)).toHaveLength(3);
  });
});

describe("nextBlockableSlot", () => {
  it("findet den nächsten freien Slot, der noch nicht begonnen hat", () => {
    const slots = [
      { id: "s1", startsAt: at(0), status: "free" as const },
      { id: "s2", startsAt: at(6), status: "sold" as const },
      { id: "s3", startsAt: at(12), status: "blocked" as const },
      { id: "s4", startsAt: at(18), status: "reserved" as const },
      { id: "s5", startsAt: at(24), status: "free" as const },
    ];
    expect(nextBlockableSlot(slots, at(3))).toBe("s5");
  });

  it("liefert null, wenn kein freier Slot mehr kommt", () => {
    expect(
      nextBlockableSlot([{ id: "s1", startsAt: at(0), status: "free" }], at(1)),
    ).toBeNull();
  });
});
