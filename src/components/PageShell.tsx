import AppHeader from "@/components/AppHeader";

/**
 * Header plus the single-column body the non-board screens share. The board
 * composes AppHeader itself — its body is a two-column grid with a sticky rail,
 * which is enough of a difference not to try to fold in here.
 */
export default function PageShell({
  title,
  meta,
  metaShort,
  children,
}: {
  title: string;
  meta: string;
  metaShort?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader title={title} meta={meta} metaShort={metaShort} />
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-[18px] px-5 pt-[18px] pb-10 lg:gap-6 lg:px-10 lg:pt-8 lg:pb-11">
        {children}
      </main>
    </div>
  );
}
