import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('eats i18n', () => {
  const required = [
    'title', 'addRestaurant', 'editRestaurant', 'empty.headline', 'empty.subtext',
    'filterAll', 'filterWantToTry', 'filterBeen',
    'statusWantToTry', 'statusBeen', 'markBeen', 'markWantToTry',
    'nameLabel', 'cuisineLabel', 'ratingLabel', 'priceLabel', 'notesLabel', 'statusLabel',
    'cuisineUnknown', 'noRating', 'scheduledOn', 'notScheduled',
    'scheduleToDay', 'unschedule', 'dayPickerTitle', 'save', 'cancel', 'delete', 'confirmDelete',
    'loading', 'errorHeadline', 'errorSubtext', 'saveFailed',
  ];

  function get(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], obj);
  }

  it('has an eats namespace with all required keys', () => {
    expect(en).toHaveProperty('eats');
    for (const key of required) {
      expect(get((en as Record<string, unknown>).eats as Record<string, unknown>, key), `eats.${key}`).toBeTruthy();
    }
  });
});
