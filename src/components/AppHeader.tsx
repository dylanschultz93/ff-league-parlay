import NavTabs from "@/components/NavTabs";

/**
 * The bar every screen sits under: what you're looking at, then the tabs.
 *
 * `action` is the screen's one primary control. Only the board has one, and
 * only from lg up — on a phone that control lives in the thumb rail at the
 * bottom instead, so the header stays a header.
 */
export default function AppHeader({
  title,
  meta,
  metaShort,
  action,
}: {
  title: string;
  /** Left off when the database is unreachable and the week isn't known. */
  meta?: string;
  /** Shown below lg, where the full meta line doesn't fit. Defaults to `meta`. */
  metaShort?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-app px-5 pt-[22px] lg:px-10">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink lg:text-[22px]">
              {title}
            </h1>
            {meta && (
              <span className="hidden font-mono text-[13px] text-muted lg:inline">
                {meta}
              </span>
            )}
          </div>
          {(metaShort ?? meta) && (
            <span className="font-mono text-xs text-muted lg:hidden">
              {metaShort ?? meta}
            </span>
          )}
          {action}
        </div>
        <NavTabs />
      </div>
    </header>
  );
}
