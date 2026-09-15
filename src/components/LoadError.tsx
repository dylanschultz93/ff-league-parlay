/**
 * A read that didn't come back. The screens that only read render this in place
 * of their contents, so a database that is down reads as a sentence rather than
 * an empty page pretending there is nothing on the record.
 */
export default function LoadError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border px-4 py-3 text-[13px]"
      style={{
        color: "var(--danger-text)",
        borderColor: "var(--danger-border)",
        background: "var(--danger-bg)",
      }}
    >
      {message}
    </p>
  );
}
