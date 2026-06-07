import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.json journal namespace', () => {
  const required = [
    // load + segmented control
    'loading', 'errorHeadline', 'errorSubtext', 'entries', 'readingList',
    'readingListComingSoon',
    // entries feed
    'newEntry', 'emptyHeadline', 'emptySubtext',
    // reader
    'back', 'edit',
    // editor sheet
    'newEntry', 'editEntry', 'titleLabel', 'dateLabel', 'bodyLabel',
    'save', 'cancel', 'delete', 'confirmDelete',
    'titleRequired', 'saveFailed', 'mutationFailed', 'offlineHint',
    // markdown toolbar
    'mdToolbar', 'mdBold', 'mdItalic', 'mdHeading', 'mdList', 'mdLink',
    // photos (edit mode)
    'addPhoto', 'addPhotoOffline', 'uploadingPhoto', 'photosAfterSaveHint',
    'photoNotImage', 'photoTooLarge', 'photoTooMany', 'photoUploadFailed',
  ];

  it('defines every journal UI key', () => {
    const j: Record<string, unknown> = en.journal as unknown as Record<string, unknown>;
    expect(j).toBeDefined();
    for (const k of required) expect(j[k], `journal.${k}`).toBeTypeOf('string');
  });
});
