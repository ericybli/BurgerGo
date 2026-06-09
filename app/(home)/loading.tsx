import { withBase } from '@/src/lib/basePath';

/**
 * Atlas Light splash (design handoff A0) — the suspense fallback for the Home
 * entry route, i.e. what shows while the PWA boots. Scoped to the (home)
 * segment on purpose: trip-tab navigations keep their own inline skeletons and
 * never flash a full-screen splash.
 *
 * Copy is intentionally hardcoded: the app is English-only and a suspense
 * fallback must render instantly (no async message loading).
 */
export default function HomeLoading() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-cream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase('/burgergo-logo.png')}
        alt=""
        aria-hidden="true"
        width={190}
        height={179}
        className="block w-[190px] object-contain drop-shadow-[0_14px_24px_rgba(27,31,28,0.14)]"
      />
      <p className="mt-5 text-[27px] font-extrabold tracking-[-0.03em] text-ink">BurgerGo</p>
      <p className="mt-1.5 whitespace-nowrap text-[13px] text-sub">Burger packs. You wander.</p>
      <div className="absolute bottom-[76px] flex gap-[7px]" aria-hidden="true">
        <span className="h-[7px] w-[7px] animate-pulse rounded-chip bg-orange" />
        <span className="h-[7px] w-[7px] animate-pulse rounded-chip bg-ink/20 [animation-delay:150ms]" />
        <span className="h-[7px] w-[7px] animate-pulse rounded-chip bg-ink/20 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
