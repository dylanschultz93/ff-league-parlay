/**
 * What a screen says before there is anything on it. Distinct from LoadError:
 * this one means the read worked and the answer was nothing yet.
 */
export default function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-dash px-4 py-3.5 text-[13px] text-muted-2">
      {children}
    </p>
  );
}
