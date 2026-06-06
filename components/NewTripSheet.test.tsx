import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const createTripAction = vi.fn(async () => ({ id: 't-new' }));
vi.mock('@/app/_actions/trips', () => ({
  createTripAction: (...args: Parameters<typeof createTripAction>) => createTripAction(...args),
  renameTripAction: vi.fn(),
}));

import { NewTripSheet } from './NewTripSheet';

function renderSheet(onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <NewTripSheet open onClose={onClose} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  createTripAction.mockClear();
});

describe('NewTripSheet', () => {
  it('shows an inline error and does not submit when end < start', async () => {
    renderSheet();
    await userEvent.type(screen.getByLabelText(en.newTripSheet.nameLabel), 'Tokyo');
    const start = screen.getByLabelText(en.newTripSheet.startLabel);
    const end = screen.getByLabelText(en.newTripSheet.endLabel);
    await userEvent.type(start, '2026-05-09');
    await userEvent.type(end, '2026-05-03');
    await userEvent.click(screen.getByRole('button', { name: en.newTripSheet.create }));
    expect(screen.getByText(en.newTripSheet.endBeforeStart)).toBeInTheDocument();
    expect(createTripAction).not.toHaveBeenCalled();
  });

  it('shows an inline error when the name is blank', async () => {
    renderSheet();
    const start = screen.getByLabelText(en.newTripSheet.startLabel);
    const end = screen.getByLabelText(en.newTripSheet.endLabel);
    await userEvent.type(start, '2026-05-03');
    await userEvent.type(end, '2026-05-09');
    await userEvent.click(screen.getByRole('button', { name: en.newTripSheet.create }));
    expect(screen.getByText(en.newTripSheet.nameRequired)).toBeInTheDocument();
    expect(createTripAction).not.toHaveBeenCalled();
  });

  it('calls createTripAction with valid input', async () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    await userEvent.type(screen.getByLabelText(en.newTripSheet.nameLabel), 'Tokyo');
    await userEvent.type(screen.getByLabelText(en.newTripSheet.startLabel), '2026-05-03');
    await userEvent.type(screen.getByLabelText(en.newTripSheet.endLabel), '2026-05-09');
    await userEvent.click(screen.getByRole('button', { name: en.newTripSheet.create }));
    expect(createTripAction).toHaveBeenCalledWith({
      name: 'Tokyo',
      startDate: '2026-05-03',
      endDate: '2026-05-09',
    });
  });
});
