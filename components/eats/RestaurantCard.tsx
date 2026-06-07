'use client';

import { useTranslations } from 'next-intl';
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
      className="flex w-full flex-col gap-1 rounded-card bg-card p-3 text-left shadow-card"
    >
      {thumb.kind === 'photo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.src} alt={restaurant.name} className="mb-1 h-32 w-full rounded-control object-cover" />
      ) : null}

      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-body font-bold text-ink">{restaurant.name}</span>
        <span
          className={`shrink-0 rounded-chip px-2 py-0.5 text-caption font-medium ${
            restaurant.status === 'been' ? 'bg-teal text-white' : 'bg-paper text-ink-muted'
          }`}
        >
          {statusLabel}
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
        {restaurant.cuisine ? (
          <span className="rounded-chip bg-paper px-2 py-0.5 text-ink-muted">{restaurant.cuisine}</span>
        ) : null}
        {stars ? (
          <span aria-label={`${restaurant.rating} out of 5`} className="text-coral">
            {'★'.repeat(stars.filled)}
            <span className="text-line">{'★'.repeat(stars.empty)}</span>
          </span>
        ) : null}
        {price ? <span className="font-medium text-ink">{price}</span> : null}
      </span>

      {restaurant.notes ? (
        <span className="truncate text-caption text-ink-muted">{restaurant.notes}</span>
      ) : null}

      {restaurant.scheduledDayDate ? (
        <span className="text-caption font-medium text-teal">
          {t('scheduledOn', { date: restaurant.scheduledDayDate })}
        </span>
      ) : null}
    </button>
  );
}
