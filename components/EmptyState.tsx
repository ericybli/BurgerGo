'use client';

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
        src="/burgergo-logo.png"
        alt={mascotAlt}
        width={112}
        height={112}
        className="mb-6 h-28 w-28 opacity-90"
      />
      <h2 className="text-heading font-semibold text-ink">{headline}</h2>
      <p className="mt-2 max-w-xs text-body text-ink-muted">{subtext}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-control bg-coral px-5 py-3 text-label font-medium text-white shadow-card active:bg-coral-press"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
