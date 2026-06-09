'use client';

import { withBase } from '@/src/lib/basePath';

type EmptyStateProps = {
  mascotAlt: string;
  headline: string;
  subtext: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  mascotAlt,
  headline,
  subtext,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* Bundled mascot asset → always renders offline (§9.6). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase('/burgergo-logo.png')}
        alt={mascotAlt}
        width={112}
        height={112}
        className="mb-6 h-28 w-28 opacity-90"
      />
      <h2 className="text-heading text-ink">{headline}</h2>
      <p className="mt-2 max-w-xs text-body text-sub">{subtext}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex items-center justify-center rounded-[12px] bg-orange px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:scale-[0.98] active:bg-orange-press"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
