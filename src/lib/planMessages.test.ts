import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.plan messages', () => {
  it('contains every key the Plan UI references', () => {
    const keys = [
      'listTab', 'mapTab', 'daysTab', 'savedTab',
      'dayChip', 'todayDot', 'travelModeWalk', 'travelModeDrive', 'travelModeTransit',
      'legNeedsConnection', 'openInGoogleMaps', 'openDayRoute',
      'addPlace', 'addFromSaved', 'addToDay', 'moveToSaved', 'moveToDay', 'delete',
      'emptyDayHeadline', 'emptyDaySubtext', 'emptySavedHeadline', 'emptySavedSubtext',
      'searchPlaceholder', 'addressSearchPlaceholder', 'addressSearchHint', 'nameRequired', 'confirm', 'cancel',
      'nameLabel', 'addressLabel', 'categoryLabel', 'timeLabel', 'notesLabel', 'save',
      'manage', 'clear',
      'upNext', 'noTimeSet', 'skip', 'dayPickerTitle', 'recompute',
      'loading', 'errorHeadline', 'errorSubtext', 'reorderHint',
    ];
    for (const k of keys) {
      expect(en.plan, `missing plan.${k}`).toHaveProperty(k);
      expect(typeof (en.plan as Record<string, string>)[k]).toBe('string');
    }
  });

  it('contains the place category labels', () => {
    for (const c of [
      'sightseeing', 'lodging', 'hotel', 'airbnb', 'airport', 'transport',
      'activity', 'shopping', 'parking', 'entrance', 'museum', 'event', 'other',
    ]) {
      expect(en.placeCategory, `missing placeCategory.${c}`).toHaveProperty(c);
    }
  });
});
