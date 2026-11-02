import { z } from "zod";

/** Admin-Formular für Gutscheine. */
export const couponSchema = z.any().transform((): never => {
  throw new Error("noch nicht umgesetzt");
});

export type CouponInput = z.infer<typeof couponSchema>;
