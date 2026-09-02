"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Listbox replacement for a native <select>. A native control can't be styled
 * to match the design's field treatment, and its default rendering on desktop
 * is jarring next to the rest of the form.
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
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
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

  function choose(index: number) {
    const name = names[index];
    if (name === undefined) return;
    onChange(name);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent) {
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
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
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
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${activeIndex}`}
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 left-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-[14px] border border-input-line bg-card p-1.5 shadow-2xl shadow-black/60 outline-none"
        >
          {names.map((name, index) => {
            const selected = name === value;
            return (
              <li
                key={name}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center justify-between rounded-[10px] px-3.5 py-3 text-[15px] ${
                  index === activeIndex ? "bg-[#1c2126]" : ""
                } ${selected ? "text-accent" : "text-ink-2"}`}
              >
                {name}
                {selected && <span aria-hidden>✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
