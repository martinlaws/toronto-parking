"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The two controls on the diagram's bottom edge, plus the colour-blind label
 * toggle. All three write a `data-` attribute on `<html>` that the stylesheet
 * reads, so a tap re-paints the board without re-rendering a single node.
 *
 * Every `localStorage` access sits in a `try`/`catch`: a locked-down browser
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

const BUTTON =
  "tp-fade inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function RotateControl() {
  // The server cannot know what this device stored, so the first paint is the
  // default and the effect below corrects it after hydration.
  const [orientation, setOrientation] = useState<Orientation>(DEFAULT_ORIENTATION);
  const [labels, setLabels] = useState(false);
  const [ready, setReady] = useState(false);
  const [wakeSupported, setWakeSupported] = useState(false);
  const [awake, setAwake] = useState(false);
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const wanted = useRef(false);

  useEffect(() => {
    const stored = readStored(ORIENTATION_KEY);
    const next = isOrientation(stored) ? stored : DEFAULT_ORIENTATION;
    setOrientation(next);
    document.documentElement.dataset.orientation = next;

    const storedLabels = readStored(LABELS_KEY) === "on";
    setLabels(storedLabels);
    document.documentElement.dataset.labels = storedLabels ? "on" : "off";

    setWakeSupported("wakeLock" in navigator);
    setReady(true);
  }, []);

  const rotate = useCallback(() => {
    setOrientation((current) => {
      const next = ORIENTATIONS[(ORIENTATIONS.indexOf(current) + 1) % ORIENTATIONS.length];
      document.documentElement.dataset.orientation = next;
      writeStored(ORIENTATION_KEY, next);
      return next;
    });
  }, []);

  const toggleLabels = useCallback(() => {
    setLabels((current) => {
      const next = !current;
      document.documentElement.dataset.labels = next ? "on" : "off";
      writeStored(LABELS_KEY, next ? "on" : "off");
      return next;
    });
  }, []);

  // The lock is asked for on a tap and never on mount: an unprompted request is
  // rejected by every browser that implements it, and it lives for this page
  // load only, so nothing about it is stored.
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
      try {
        await sentinel.current.release();
      } catch {
        // Already gone.
      }
      sentinel.current = null;
      setAwake(false);
      return;
    }
    wanted.current = true;
    await acquire();
  }, [acquire]);

  // A screen lock is dropped whenever the tab is hidden, so it has to be asked
  // for again on the way back.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && wanted.current && !sentinel.current) {
        void acquire();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel.current?.release().catch(() => {});
      sentinel.current = null;
    };
  }, [acquire]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button type="button" onClick={rotate} className={BUTTON} aria-label={`Rotate the board. The exit is at the ${orientation}.`}>
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

      {/* The fallback replaces the button rather than sitting beside a dead one. */}
      <p className="w-full text-center text-sm text-ink/60" hidden={!ready || wakeSupported}>
        This browser can&apos;t hold the screen on. Turn your auto-lock up for a bit.
      </p>
    </div>
  );
}
