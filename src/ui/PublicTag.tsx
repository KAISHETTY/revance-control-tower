/** Marks a fact taken from public information (everything else in the app is synthetic). */
export function PublicTag() {
  return (
    <span className="ml-1 inline-flex items-center rounded-full bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-info ring-1 ring-info/30 ring-inset">
      From public sources
    </span>
  );
}
