import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addLinkAction = vi.fn(async (_input: any) => ({ id: 'l-new' }));
const deleteLinkAction = vi.fn(async (_id: string) => {});
vi.mock('@/app/_actions/savedLinks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addLinkAction: (input: any) => addLinkAction(input),
  deleteLinkAction: (id: string) => deleteLinkAction(id),
  updateLinkAction: vi.fn(),
}));
vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ title: 'T', thumbnailPath: null }) })) as unknown as typeof fetch);

import { PlaceLinks } from './PlaceLinks';

function renderLinks(props = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceLinks tripId="t1" placeId="p1" links={[]} disabled={false} onChanged={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => { addLinkAction.mockClear(); deleteLinkAction.mockClear(); });

describe('PlaceLinks', () => {
  it('adds a link with the place id', async () => {
    const onChanged = vi.fn();
    renderLinks({ onChanged });
    await userEvent.type(screen.getByLabelText(en.plan.addGuideLink), 'https://g.example');
    await userEvent.click(screen.getByRole('button', { name: en.plan.addGuideLink }));
    await waitFor(() => expect(addLinkAction).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', placeId: 'p1', url: 'https://g.example' }),
    ));
    expect(onChanged).toHaveBeenCalled();
  });

  it('lists existing links with a remove button', async () => {
    const onChanged = vi.fn();
    renderLinks({ links: [{ id: 'l1', url: 'https://x.example', title: 'X', thumbnail: null }], onChanged });
    await userEvent.click(screen.getByRole('button', { name: en.plan.delete }));
    await waitFor(() => expect(deleteLinkAction).toHaveBeenCalledWith('l1'));
  });
});
