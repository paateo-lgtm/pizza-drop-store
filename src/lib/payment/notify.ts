/** Anlass für eine Kundenmail nach Zahlung oder Storno. */
export type OrderNotice = {
  kind: "confirmed" | "refunded" | "cancelled";
  orderId: string;
};

export type Notify = (notice: OrderNotice) => Promise<void>;

/** Mails dürfen Zahlung oder Storno nie scheitern lassen: Fehler werden nur protokolliert. */
export async function notifySafely(notify: Notify, notice: OrderNotice) {
  try {
    await notify(notice);
  } catch (error) {
    console.error(
      `Mail „${notice.kind}“ für ${notice.orderId} fehlgeschlagen`,
      error,
    );
  }
}
