"use client";

import { PackageCheck, QrCode, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrderStatus } from "@/lib/domain/drops";
import { findPickupOrders, parseScannedCode } from "@/lib/domain/pickup";
import { formatTime } from "@/lib/format";
import type { KitchenBoard } from "@/lib/kitchen/kitchen";

type Order = KitchenBoard["orders"][number];

const STATE: Partial<Record<OrderStatus, string>> = {
  PAID: "Wartet auf den Ofen",
  IN_PROGRESS: "Noch im Ofen",
  PICKED_UP: "Schon abgeholt",
};

/** Ausgabe: Bestellung per Nummer, Name, Abholcode oder QR-Code finden und ausgeben. */
export function PickupDesk({
  orders,
  pending,
  onPickUp,
}: {
  orders: Order[];
  pending: boolean;
  onPickUp: (orderId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const hits = findPickupOrders(orders, query);
  const searched = query.trim().replace(/^#/, "").trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Bestellung suchen</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nummer, Name oder Code"
            autoComplete="off"
            className="h-12 pl-10 text-lg"
          />
        </label>
        <ScanButton
          onScan={(code) => {
            setQuery(code);
            setScanning(false);
          }}
          scanning={scanning}
          setScanning={setScanning}
        />
      </div>
      {searched && (
        <div aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-ink-muted">Keine passende Bestellung.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Suchergebnis">
              {hits.map((order) => (
                <li
                  key={order.id}
                  className="rounded-md border border-olive/60 p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xl font-semibold tabular-nums">
                      #{order.number} · {order.customer}
                    </span>
                    <span className="text-ink-muted tabular-nums">
                      {formatTime(order.pickupAt)}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {order.pizzas} · Code{" "}
                    <span className="font-mono tracking-widest">
                      {order.pickupCode}
                    </span>
                  </p>
                  {order.status === "READY" ? (
                    <Button
                      className="mt-2 h-11 w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                      aria-disabled={pending}
                      aria-label={`Abgeholt: Bestellung #${order.number}`}
                      onClick={() => {
                        if (pending) return;
                        onPickUp(order.id);
                        setQuery("");
                      }}
                    >
                      <PackageCheck aria-hidden /> Abgeholt
                    </Button>
                  ) : (
                    <p className="mt-1 font-semibold text-terracotta">
                      {STATE[order.status] ?? "Nicht ausgeben"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QR-Scan über die eingebaute BarcodeDetector-API ────────────────────────
// Kein Zusatzpaket: Chrome/Android kann es. Wo es fehlt (z. B. Safari), wird der
// Code einfach eingetippt – die Suche findet ihn genauso.

type Detector = {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};
type DetectorClass = new (options: { formats: string[] }) => Detector;

const detectorClass = () =>
  (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;

const noop = () => () => {};

function ScanButton({
  onScan,
  scanning,
  setScanning,
}: {
  onScan: (code: string) => void;
  scanning: boolean;
  setScanning: (value: boolean) => void;
}) {
  // Erst im Browser bekannt; auf dem Server nie anzeigen (kein Hydration-Fehler).
  const supported = useSyncExternalStore(
    noop,
    () => Boolean(detectorClass() && navigator.mediaDevices),
    () => false,
  );
  if (!supported) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-12"
        onClick={() => setScanning(true)}
      >
        <QrCode aria-hidden /> QR scannen
      </Button>
      {scanning && (
        <Scanner onScan={onScan} onClose={() => setScanning(false)} />
      )}
    </>
  );
}

function Scanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Das Board rendert bei jedem Polling neu; die Kamera soll deshalb nicht neu starten.
  const handlers = useRef({ onScan, onClose });
  useEffect(() => {
    handlers.current = { onScan, onClose };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handlers.current.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer = 0;
    let active = true;

    async function scan() {
      if (!active || !video.current) return;
      try {
        const [hit] = await detector.detect(video.current);
        const code = hit && parseScannedCode(hit.rawValue);
        if (code && active) {
          handlers.current.onScan(code);
          return;
        }
      } catch {
        // Einzelbild nicht lesbar (Video lädt noch): beim nächsten Bild weiter.
      }
      timer = window.setTimeout(scan, 250);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (!active || !video.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = s;
        // Nicht auf play() warten: Bilder, die noch nicht lesbar sind, wiederholt scan().
        video.current.play().catch(() => undefined);
        void scan();
      })
      .catch(() => {
        if (active) {
          setProblem(
            "Kamera nicht verfügbar – bitte den Code eintippen oder die Kamera erlauben.",
          );
        }
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="QR-Code scannen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-6"
    >
      {problem ? (
        <p role="alert" className="max-w-md text-center text-lg text-white">
          {problem}
        </p>
      ) : (
        <>
          <video
            ref={video}
            muted
            playsInline
            className="aspect-square w-full max-w-md rounded-md object-cover"
          />
          <p className="text-lg text-white">
            QR-Code des Kunden vor die Kamera
          </p>
        </>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-14"
        autoFocus
        onClick={onClose}
      >
        <X aria-hidden /> Schließen
      </Button>
    </div>
  );
}
