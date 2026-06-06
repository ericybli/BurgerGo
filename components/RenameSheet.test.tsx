import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const renameTripAction = vi.fn(async () => undefined);
vi.mock('@/app/_actions/trips', () => ({
  createTripAction: vi.fn(),
  renameTripAction: (...args: Parameters<typeof renameTripAction>) => renameTripAction(...args),
}));

import { RenameSheet } from './RenameSheet';

function renderSheet(onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RenameSheet open tripId="t1" currentName="Tokyo" onClose={onClose} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  renameTripAction.mockClear();
});

describe('RenameSheet', () => {
  it('pre-fills the current name', () => {
    renderSheet();
    expect(
      (screen.getByLabelText(en.renameSheet.nameLabel) as HTMLInputElement).value,
    ).toBe('Tokyo');
  });

  it('blocks save and shows an error when the name is cleared', async () => {
    renderSheet();
    await userEvent.clear(screen.getByLabelText(en.renameSheet.nameLabel));
    await userEvent.click(screen.getByRole('button', { name: en.renameSheet.save }));
    expect(screen.getByText(en.renameSheet.nameRequired)).toBeInTheDocument();
    expect(renameTripAction).not.toHaveBeenCalled();
  });

  it('calls renameTripAction with the trimmed new name', async () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const input = screen.getByLabelText(en.renameSheet.nameLabel);
    await userEvent.clear(input);
    await userEvent.type(input, '  Kyoto  ');
    await userEvent.click(screen.getByRole('button', { name: en.renameSheet.save }));
    expect(renameTripAction).toHaveBeenCalledWith('t1', 'Kyoto');
  });
});
