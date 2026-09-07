"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CONTROL } from "@/lib/ui";

/**
 * The two controls on the diagram's bottom edge, plus the colour-blind label
 * toggle. All three write a `data-` attribute on `<html>` that the stylesheet
 * reads, so a tap re-paints the board without re-rendering a single node.
 *
 * The server has no idea what this device stored, so every stored value goes
 * through `useSyncExternalStore` with a server snapshot equal to the default:
 * the first paint matches the HTML, and the stored value lands on the next
 * render rather than as a hydration mismatch.
 *
 * Every `localStorage` access sits in a `try`/`catch`. A locked-down browser
 * throws on the getter itself, and none of this is worth an error boundary.
 */

const ORIENTATIONS = ["right", "bottom", "left", "top"] as const;
type Orientation = (typeof ORIENTATIONS)[number];

/** `bottom` matches the photo of the board and is the default the CSS assumes. */
const DEFAULT_ORIENTATION: Orientation = "bottom";

const ORIENTATION_KEY = "tp.orientation";
const LABELS_KEY = "tp.labels";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A private window, or site data switched off. The page still works.
  }
}

function isOrientation(value: string | null): value is Orientation {
  return value !== null && (ORIENTATIONS as readonly string[]).includes(value);
}

// A two-value store, read once and kept in module scope so the snapshot is
// referentially stable; another tab's write arrives through `storage`.
const listeners = new Set<() => void>();
let orientationCache: Orientation | null = null;
let labelsCache: boolean | null = null;

// Taps counted, not an angle named. The stylesheet turns the board by
// `--tp-turn`, so `top` back to `right` is turn 4 rather than a return to 0,
// and the board takes one more quarter turn forward instead of unwinding three
// quarters backwards. It only ever grows within a tab; clearing it alongside
// the other two below is what makes another tab's write land as a reset from
// the stored orientation's index rather than as a step of this tab's own, which
// is what keeps two open tabs on the same angle.
let turnCache: number | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = () => {
    orientationCache = null;
    labelsCache = null;
    turnCache = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function orientationSnapshot(): Orientation {
  if (orientationCache === null) {
    const stored = readStored(ORIENTATION_KEY);
    orientationCache = isOrientation(stored) ? stored : DEFAULT_ORIENTATION;
  }
  return orientationCache;
}

function labelsSnapshot(): boolean {
  if (labelsCache === null) labelsCache = readStored(LABELS_KEY) === "on";
  return labelsCache;
}

function turnSnapshot(): number {
  if (turnCache === null) turnCache = ORIENTATIONS.indexOf(orientationSnapshot());
  return turnCache;
}

function serverOrientation(): Orientation {
  return DEFAULT_ORIENTATION;
}

function serverTurn(): number {
  return ORIENTATIONS.indexOf(DEFAULT_ORIENTATION);
}

function serverFalse(): boolean {
  return false;
}

function serverTrue(): boolean {
  return true;
}

function neverChanges(): () => void {
  return () => {};
}

function wakeSupportedSnapshot(): boolean {
  return "wakeLock" in navigator;
}

const BUTTON = CONTROL;

export default function RotateControl() {
  const orientation = useSyncExternalStore(subscribe, orientationSnapshot, serverOrientation);
  const turn = useSyncExternalStore(subscribe, turnSnapshot, serverTurn);
  const labels = useSyncExternalStore(subscribe, labelsSnapshot, serverFalse);
  const wakeSupported = useSyncExternalStore(neverChanges, wakeSupportedSnapshot, serverFalse);
  const hydrated = useSyncExternalStore(neverChanges, serverTrue, serverFalse);

  const [awake, setAwake] = useState(false);
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const wanted = useRef(false);

  // The stylesheet is the external system here: it reads these attributes and
  // nothing in React re-renders when they change. The angle and the name go on
  // together: the board and the frame letters turn by `--tp-turn`, and
  // `data-orientation` stays for everything that reads a name, EXIT and the
  // piece letters included. This write is silent by design: `data-tp-ready`,
  // and so the transition, is set by `rotate` alone, so the first paint and
  // another tab's `storage` write both land instantly.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.orientation = orientation;
    root.style.setProperty("--tp-turn", `${turn * 90}deg`);
  }, [orientation, turn]);

  useEffect(() => {
    document.documentElement.dataset.labels = labels ? "on" : "off";
  }, [labels]);

  const rotate = useCallback(() => {
    // Arm the 200ms sweep here rather than in the stylesheet's base rule. The
    // stored orientation lands after hydration, and an armed transition would
    // turn that into a sweep on every page load for anyone who left the board
    // anywhere but `bottom`. A tap is the one turn worth watching.
    document.documentElement.dataset.tpReady = "";
    const turns = turnSnapshot() + 1;
    const next = ORIENTATIONS[turns % ORIENTATIONS.length];
    turnCache = turns;
    orientationCache = next;
    writeStored(ORIENTATION_KEY, next);
    emit();
  }, []);

  const toggleLabels = useCallback(() => {
    const next = !labelsSnapshot();
    labelsCache = next;
    writeStored(LABELS_KEY, next ? "on" : "off");
    emit();
  }, []);

  // The lock is asked for on a tap and never on mount: an unprompted request is
  // refused by every browser that implements it. It lives for this page load
  // only, so nothing about it is stored.
  const acquire = useCallback(async () => {
    try {
      const lock = await navigator.wakeLock.request("screen");
      sentinel.current = lock;
      lock.addEventListener("release", () => {
        sentinel.current = null;
        setAwake(false);
      });
      setAwake(true);
    } catch {
      wanted.current = false;
      setAwake(false);
    }
  }, []);

  const toggleAwake = useCallback(async () => {
    if (sentinel.current) {
      wanted.current = false;
      const lock = sentinel.current;
      sentinel.current = null;
      setAwake(false);
      try {
        await lock.release();
      } catch {
        // Already gone.
      }
      return;
    }
    wanted.current = true;
    await acquire();
  }, [acquire]);

  // A screen lock is dropped whenever the tab is hidden, so it has to be asked
  // for again on the way back.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && wanted.current && !sentinel.current) {
        void acquire();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const lock = sentinel.current;
      sentinel.current = null;
      void lock?.release().catch(() => {});
    };
  }, [acquire]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={rotate}
        className={BUTTON}
        aria-label={`Rotate the board. The exit is at the ${orientation}.`}
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.6-6.4" />
          <path d="M21 3v5h-5" />
        </svg>
        Rotate
      </button>

      <button type="button" onClick={toggleLabels} className={BUTTON} aria-pressed={labels}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5V4h4.5L20 16.5 16.5 20 4 7.5Z" />
          <circle cx="7" cy="7" r="1.2" />
        </svg>
        Label colours
      </button>

      {wakeSupported ? (
        <button type="button" onClick={toggleAwake} className={BUTTON} aria-pressed={awake}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </svg>
          {awake ? "Screen staying on" : "Keep awake"}
        </button>
      ) : null}

      {/* The line replaces the button rather than sitting beside a dead one. */}
      <p className="w-full text-center text-sm text-ink/60" hidden={!hydrated || wakeSupported}>
        This browser can&apos;t hold the screen on. Turn your auto-lock up for a bit.
      </p>
    </div>
  );
}
