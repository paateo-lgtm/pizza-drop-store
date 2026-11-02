import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { toBerlinLocalInput } from "@/lib/time";
import { centsToEuroInput } from "@/lib/validation/common";
import { PageHeader, PageSkeleton } from "../../_components/page-header";
import { CouponForm } from "../coupon-form";
import { getDropOptions } from "../data";

export const metadata: Metadata = { title: "Gutschein bearbeiten" };

export default function EditCouponPage(
  props: PageProps<"/admin/gutscheine/[id]">,
) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Gutschein bearbeiten" />
          <PageSkeleton rows={6} />
        </>
      }
    >
      <EditCoupon params={props.params} />
    </Suspense>
  );
}

async function EditCoupon({
  params,
}: Pick<PageProps<"/admin/gutscheine/[id]">, "params">) {
  await requireUser("coupons:manage");
  const { id } = await params;
  const coupon = await db.coupon.findUnique({
    where: { id },
    include: { drops: { select: { dropId: true } } },
  });
  if (!coupon) notFound();
  const dropIds = coupon.drops.map((d) => d.dropId);
  const drops = await getDropOptions(dropIds);
  const text = (n: number | null) => (n === null ? "" : String(n));

  return (
    <>
      <PageHeader title={coupon.code} description="Gutschein bearbeiten" />
      <CouponForm
        drops={drops}
        initial={{
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value:
            coupon.type === "PERCENT"
              ? String(coupon.value)
              : centsToEuroInput(coupon.value),
          validFrom: coupon.validFrom
            ? toBerlinLocalInput(coupon.validFrom)
            : "",
          validTo: coupon.validTo ? toBerlinLocalInput(coupon.validTo) : "",
          maxRedemptions: text(coupon.maxRedemptions),
          maxPerCustomer: text(coupon.maxPerCustomer),
          active: coupon.active,
          dropIds,
        }}
      />
    </>
  );
}
