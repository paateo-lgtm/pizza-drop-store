"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sendFeedback, type FeedbackFormState } from "../actions";

const LABELS = ["", "Schlecht", "Geht so", "Gut", "Sehr gut", "Hervorragend"];

/** 1–5 Sterne als Radiogruppe (per Tastatur bedienbar) und ein optionaler Kommentar. */
export function FeedbackForm({
  orderId,
  feedbackKey,
}: {
  orderId: string;
  feedbackKey: string;
}) {
  const [state, action, pending] = useActionState<FeedbackFormState, FormData>(
    sendFeedback.bind(null, orderId, feedbackKey),
    null,
  );
  const [rating, setRating] = useState(0);

  if (state?.ok) {
    return (
      <div role="status" className="mt-8">
        <h2 className="text-3xl">Danke dir!</h2>
        <p className="mt-2 text-lg text-ink-muted">
          Deine Bewertung hilft uns, beim nächsten Drop noch besser zu backen.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-6">
      <fieldset>
        <legend className="text-sm font-medium">Deine Bewertung</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={n}
                required
                className="peer sr-only"
                checked={rating === n}
                onChange={() => setRating(n)}
              />
              <span className="sr-only">
                {n} {n === 1 ? "Stern" : "Sterne"} – {LABELS[n]}
              </span>
              <Star
                aria-hidden
                className={cn(
                  "size-10 rounded-sm text-terracotta transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                  n <= rating ? "fill-current" : "fill-transparent",
                )}
              />
            </label>
          ))}
        </div>
        <p className="mt-1 h-5 text-sm text-ink-muted" aria-hidden>
          {LABELS[rating]}
        </p>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Kommentar (optional)</span>
        <Textarea name="comment" rows={4} maxLength={1000} />
      </label>
      {state?.ok === false && (
        <p role="alert" className="text-terracotta">
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="self-start aria-disabled:opacity-50"
        aria-disabled={pending}
        onClick={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        {pending ? "Wird gesendet …" : "Bewertung senden"}
      </Button>
    </form>
  );
}
