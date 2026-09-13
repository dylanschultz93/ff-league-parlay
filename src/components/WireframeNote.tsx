/**
 * Says out loud that a screen is a drawing. Every control under one of these is
 * inert on purpose — the note goes away with the last placeholder on the page.
 */
export default function WireframeNote({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="flex flex-col gap-1 rounded-xl border border-dashed border-dash px-4 py-3 text-[13px] text-muted-2 lg:flex-row lg:items-baseline lg:gap-2.5">
      <span className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
        Wireframe
      </span>
      <span>{children}</span>
    </p>
  );
}
