"use client";

import "react-day-picker/style.css";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";

// Lightweight wrapper around react-day-picker that mirrors the semantics of
// <input type="date"> so we can drop it into existing forms (GET filter form,
// invoice create form, payments form) without changing how submit works:
// we render a hidden <input name=... /> with the ISO yyyy-mm-dd value, plus
// a styled button trigger that shows the formatted date and opens a popup
// calendar on click.
//
// Date is treated as a *local* day — no timezone shift. Picking "May 9" gives
// "2026-05-09" regardless of browser TZ.

type Props = {
  name: string;
  defaultValue?: string; // ISO yyyy-mm-dd
  required?: boolean;
  placeholder?: string;
  className?: string;
};

function parseIso(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toIso(d: Date | undefined): string {
  if (!d) return "";
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatLocal(d: Date): string {
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join(".");
}

export function DatePicker({
  name,
  defaultValue,
  required,
  placeholder = "—",
  className,
}: Props) {
  const [selected, setSelected] = useState<Date | undefined>(() =>
    parseIso(defaultValue),
  );
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isoValue = toIso(selected);
  const buttonClass = ["input", "datepicker-trigger", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={wrapperRef} className="datepicker-wrapper">
      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={selected ? "" : "dim"}>
          {selected ? formatLocal(selected) : placeholder}
        </span>
        <span className="datepicker-icon">▾</span>
      </button>
      <input type="hidden" name={name} value={isoValue} required={required} />
      {open && (
        <div className="datepicker-popup" role="dialog">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              setSelected(d);
              if (d) setOpen(false);
            }}
            weekStartsOn={1}
            showOutsideDays
            captionLayout="label"
          />
          <div className="datepicker-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSelected(undefined);
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
