"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Listbox replacement for a native <select>. A native control can't be styled
 * to match the design's field treatment, and its default rendering on desktop
 * is jarring next to the rest of the form.
 *
 * Options are real <button>s rather than clickable <li>s: with React's
 * delegated events, taps on non-interactive elements are unreliable (iOS Safari
 * in particular), and a button gets correct activation on every platform for
 * free — mouse, touch, keyboard, and assistive tech alike.
 *
 * Dismissal deliberately does not hang off a blur handler. Safari does not
 * focus a button when it is tapped, so closing on focus-out can tear the panel
 * down before the option's click is delivered, swallowing the selection.
 * Outside pointerdown and an explicit Tab case cover the same ground safely.
 */
export default function NamePicker({
  names,
  value,
  onChange,
  placeholder = "Pick your name",
}: {
  names: string[];
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // pointerdown covers mouse, touch and pen in one listener, and fires before
  // focus moves, so the panel is gone before anything underneath reacts.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move real focus onto the active option, so Enter and Space activate it
  // natively. Only keyboard navigation changes activeIndex — hover is styling
  // only — so this never yanks focus while the mouse is moving.
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${activeIndex}"]`)
      ?.focus();
  }, [open, activeIndex]);

  function openList() {
    if (names.length === 0) return;
    const selected = names.indexOf(value);
    setActiveIndex(selected === -1 ? 0 : selected);
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function choose(name: string) {
    // Close first: if onChange ever throws, the panel still comes down.
    close();
    onChange(name);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(names.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(names.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        // Let focus move on, but don't leave the panel hanging open.
        close(false);
        break;
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-[14px] border bg-card px-4 py-4 text-left text-base transition-colors ${
          open ? "border-[var(--accent-50)]" : "border-input-line"
        } ${value ? "text-ink-2" : "text-faint"}`}
      >
        <span>{value || placeholder}</span>
        <span
          aria-hidden
          className={`ml-3 text-xs text-muted-2 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-[14px] border border-input-line bg-card p-1.5 shadow-2xl shadow-black/60"
        >
          {names.map((name, index) => {
            const selected = name === value;
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={selected}
                data-index={index}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => choose(name)}
                className={`flex w-full items-center justify-between rounded-[10px] px-3.5 py-3 text-left text-[15px] outline-none hover:bg-[#1c2126] focus:bg-[#1c2126] ${
                  selected ? "text-accent" : "text-ink-2"
                }`}
              >
                {name}
                {selected && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
