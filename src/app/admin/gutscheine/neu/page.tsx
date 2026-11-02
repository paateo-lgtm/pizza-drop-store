import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { PageHeader, PageSkeleton } from "../../_components/page-header";
import { CouponForm } from "../coupon-form";
import { getDropOptions } from "../data";

export const metadata: Metadata = { title: "Neuer Gutschein" };

export default function NewCouponPage() {
  return (
    <>
      <PageHeader title="Neuer Gutschein" />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <NewCoupon />
      </Suspense>
    </>
  );
}

async function NewCoupon() {
  await requireUser("coupons:manage");
  const drops = await getDropOptions();
  return (
    <CouponForm
      drops={drops}
      initial={{
        id: null,
        code: "",
        type: "PERCENT",
        value: "",
        validFrom: "",
        validTo: "",
        maxRedemptions: "",
        maxPerCustomer: "1",
        active: true,
        dropIds: [],
      }}
    />
  );
}
