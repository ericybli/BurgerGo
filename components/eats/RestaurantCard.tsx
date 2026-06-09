'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { priceLevelLabel, ratingStars } from '@/src/lib/eatsView';
import { thumbForRestaurant } from '@/src/lib/planUrl';

type RestaurantCardProps = {
  restaurant: RestaurantDTO;
  onTap: (id: string) => void;
};

export function RestaurantCard({ restaurant, onTap }: RestaurantCardProps) {
  const t = useTranslations('eats');
  const price = priceLevelLabel(restaurant.priceLevel);
  const stars = ratingStars(restaurant.rating);
  const statusLabel = restaurant.status === 'been' ? t('statusBeen') : t('statusWantToTry');
  const thumb = thumbForRestaurant(restaurant);

  return (
    <button
      type="button"
      onClick={() => onTap(restaurant.id)}
      aria-label={restaurant.name}
      className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left transition active:opacity-70"
    >
      {thumb.kind === 'photo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.src} alt={restaurant.name} className="h-[72px] w-[72px] shrink-0 rounded-[12px] object-cover" />
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-semibold text-ink">{restaurant.name}</span>

        <span
          className={`self-start rounded-chip px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em] ${
            restaurant.status === 'been' ? 'bg-surface text-sub' : 'bg-accent-tint text-accent'
          }`}
        >
          {statusLabel}
        </span>

        <span className="flex flex-wrap items-center gap-2 text-[11.5px] text-sub">
          {restaurant.cuisine ? <span>{restaurant.cuisine}</span> : null}
          {stars ? (
            <span aria-label={`${restaurant.rating} out of 5`} className="text-accent">
              {'★'.repeat(stars.filled)}
              <span className="text-line">{'★'.repeat(stars.empty)}</span>
            </span>
          ) : null}
          {price ? <span className="font-medium [font-variant-numeric:tabular-nums]">{price}</span> : null}
        </span>

        {restaurant.notes ? (
          <span className="line-clamp-1 text-caption text-sub">{restaurant.notes}</span>
        ) : null}

        {restaurant.scheduledDayDate ? (
          <span className="text-micro uppercase text-accent">
            {t('scheduledOn', { date: restaurant.scheduledDayDate })}
          </span>
        ) : null}
      </span>

      <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-faint" />
    </button>
  );
}
