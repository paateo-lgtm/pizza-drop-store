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

/** Warum nicht ausgeben: Falsch ausgeben ist an der Theke der teuerste Fehler. */
const STATE: Partial<Record<OrderStatus, string>> = {
  PAID: "Wartet auf den Ofen",
  IN_PROGRESS: "Noch im Ofen",
  PICKED_UP: "Schon abgeholt",
  CANCELLED: "Storniert – NICHT ausgeben",
  REFUNDED: "Storniert und erstattet – NICHT ausgeben",
  NO_SHOW: "Als nicht abgeholt markiert",
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
  const input = useRef<HTMLInputElement>(null);
  const hits = findPickupOrders(orders, query);
  const searched = query.trim().replace(/^#/, "").trim().length > 0;
  // Gültiger Code ohne Treffer: anderer Drop oder vertippt – nicht „gibt es nicht“.
  const foreignCode = hits.length === 0 && parseScannedCode(query) !== null;

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
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nummer, Name oder Code"
            autoComplete="off"
            className="h-12 pl-10 text-lg"
          />
        </label>
        <ScanButton
          scanning={scanning}
          setScanning={setScanning}
          onScan={(code) => {
            setQuery(code);
            setScanning(false);
          }}
        />
      </div>
      {/* Immer vorhanden, damit Screenreader neue Treffer ansagen. */}
      <div role="status" aria-live="polite">
        {searched &&
          (hits.length === 0 ? (
            <p className="text-ink-muted">
              {foreignCode
                ? "Dieser Abholcode gehört zu keiner Bestellung dieses Drops – anderer Drop?"
                : "Keine passende Bestellung."}
            </p>
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
                        // Der Knopf verschwindet; der Fokus geht zurück in die Suche.
                        input.current?.focus();
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
          ))}
      </div>
    </div>
  );
}

// ─── QR-Scan über die eingebaute BarcodeDetector-API ────────────────────────
// Kein Zusatzpaket: Chrome/Android kann es. Wo es fehlt (z. B. Safari), wird der
// Code einfach eingetippt – die Suche findet ihn genauso.

type Detector = {
  detect(source: HTMLVideoElement): Promise<{ rawValue: unknown }[]>;
};
type DetectorClass = new (options: { formats: string[] }) => Detector;

const detectorClass = () =>
  (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;

const noop = () => () => {};

/** Liest ein Bild alle 250 ms; nach ~10 s ohne lesbares Bild gilt der Scanner als defekt. */
const SCAN_EVERY_MS = 250;
const MAX_FAILED_FRAMES = 40;

function cameraProblem(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Kamera nicht erlaubt – in den Browser-Einstellungen freigeben oder den Code eintippen.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Keine Kamera gefunden – bitte den Code eintippen.";
  }
  return "Kamera nicht verfügbar – bitte den Code eintippen.";
}

function ScanButton({
  scanning,
  setScanning,
  onScan,
}: {
  scanning: boolean;
  setScanning: (value: boolean) => void;
  onScan: (code: string) => void;
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
        aria-haspopup="dialog"
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
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notACode, setNotACode] = useState(false);
  // Das Board rendert bei jedem Polling neu; die Kamera soll deshalb nicht neu starten.
  const handlers = useRef({ onScan, onClose });
  useEffect(() => {
    handlers.current = { onScan, onClose };
  });

  // Natives Modal: Fokusfalle, Escape und inerter Hintergrund; danach Fokus zurück.
  useEffect(() => {
    const trigger = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer = 0;
    let failed = 0;
    let active = true;

    async function scan() {
      if (!active || !video.current) return;
      try {
        const [hit] = await detector.detect(video.current);
        failed = 0;
        if (hit && typeof hit.rawValue === "string") {
          const code = parseScannedCode(hit.rawValue);
          if (code && active) {
            handlers.current.onScan(code);
            return;
          }
          // Ein anderer QR-Code (z. B. eine Website): sagen, nicht stumm weiterscannen.
          if (active) setNotACode(true);
        }
      } catch (error) {
        // Einzelne Bilder sind oft nicht lesbar (Video startet noch); dauerhaft nicht.
        failed += 1;
        if (failed >= MAX_FAILED_FRAMES) {
          console.error("QR-Scanner liest keine Bilder", error);
          if (active) {
            setProblem("Der Scanner liest nichts – bitte den Code eintippen.");
          }
          return;
        }
      }
      timer = window.setTimeout(scan, SCAN_EVERY_MS);
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
      .catch((error: unknown) => {
        if (active) setProblem(cameraProblem(error));
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label="QR-Code scannen"
      aria-describedby="scan-hint"
      // Escape: schließen über den Zustand, damit React den Dialog entfernt.
      onCancel={(e) => {
        e.preventDefault();
        handlers.current.onClose();
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-black/90 p-6 text-white backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col items-center justify-center gap-4">
        {problem ? (
          <p
            id="scan-hint"
            role="alert"
            className="max-w-md text-center text-lg"
          >
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
            <p id="scan-hint" className="text-lg" aria-live="polite">
              {notACode
                ? "Das ist kein Abholcode – bitte den QR-Code auf der Bestellseite zeigen lassen."
                : "QR-Code des Kunden vor die Kamera"}
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
    </dialog>
  );
}
