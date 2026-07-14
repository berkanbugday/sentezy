import { Icon } from "./icons";
import { Tooltip } from "./Tooltip";

/** Transparent overlay bar: floats over the panel's hero. Only the upgrade chip
 *  (mirrors the reference's "Get MAX") and a mobile menu button. */
export function Topbar() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-3.5 sm:px-6">
      <button className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-paper text-slate hover:bg-mist md:hidden">
        <Icon.menu />
      </button>
      <Tooltip label="MAX planına geç" side="bottom">
        <button className="pointer-events-auto ml-auto flex items-center gap-2 rounded-full border border-hairline bg-paper/80 px-3.5 py-2 text-[13px] font-semibold text-ink backdrop-blur transition hover:bg-mist">
          <Icon.grid width={15} height={15} />
          MAX Al
        </button>
      </Tooltip>
    </header>
  );
}
