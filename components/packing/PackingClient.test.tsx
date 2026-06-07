import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const addCategoryAction = vi.fn(async (_tripId: string, _name: string) => ({ id: 'c-new' }));
const deleteCategoryAction = vi.fn(async (_id: string) => {});
const addItemAction = vi.fn(async (_input: unknown) => ({ id: 'i-new' }));
const updateItemAction = vi.fn(async (_id: string, _patch: unknown) => ({ id: 'i1' }));
const deleteItemAction = vi.fn(async (_id: string) => {});
vi.mock('@/app/_actions/packing', () => ({
  addCategoryAction: (tripId: string, name: string) => addCategoryAction(tripId, name),
  deleteCategoryAction: (id: string) => deleteCategoryAction(id),
  addItemAction: (input: unknown) => addItemAction(input),
  updateItemAction: (id: string, patch: unknown) => updateItemAction(id, patch),
  deleteItemAction: (id: string) => deleteItemAction(id),
  renameCategoryAction: vi.fn(),
}));

import { PackingClient } from '@/components/packing/PackingClient';

const PAYLOAD = {
  categories: [
    {
      id: 'c1', tripId: 't1', name: 'Clothes', orderIndex: 0, createdAt: 'x', updatedAt: 'x',
      items: [
        { id: 'i1', categoryId: 'c1', name: 'Socks', quantity: 2, packed: false, orderIndex: 0, createdAt: 'x', updatedAt: 'x' },
      ],
    },
  ],
};

function mockFetch() {
  const f = vi.fn(async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(PAYLOAD)) }));
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  return f;
}

function renderPacking() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PackingClient tripId="t1" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  addCategoryAction.mockClear();
  deleteCategoryAction.mockClear();
  addItemAction.mockClear();
  updateItemAction.mockClear();
  deleteItemAction.mockClear();
  mockFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('PackingClient', () => {
  it('renders categories and their items', async () => {
    renderPacking();
    expect(await screen.findByText('Clothes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Socks')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument(); // packed/total
  });

  it('adds a category', async () => {
    renderPacking();
    await screen.findByText('Clothes');
    await userEvent.type(screen.getByPlaceholderText(en.packing.categoryNamePlaceholder), 'Toiletries');
    await userEvent.click(screen.getByRole('button', { name: en.packing.addCategory }));
    await waitFor(() => expect(addCategoryAction).toHaveBeenCalledWith('t1', 'Toiletries'));
  });

  it('toggles an item packed via its checkbox', async () => {
    renderPacking();
    await screen.findByDisplayValue('Socks');
    await userEvent.click(screen.getByRole('checkbox', { name: /Packed: Socks/ }));
    await waitFor(() => expect(updateItemAction).toHaveBeenCalledWith('i1', { packed: true }));
  });

  it('edits an item name on blur', async () => {
    renderPacking();
    const nameInput = await screen.findByDisplayValue('Socks');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Wool socks');
    await userEvent.tab(); // blur
    await waitFor(() => expect(updateItemAction).toHaveBeenCalledWith('i1', { name: 'Wool socks' }));
  });

  it('adds an item to a category with quantity', async () => {
    renderPacking();
    await screen.findByText('Clothes');
    await userEvent.type(screen.getByPlaceholderText(en.packing.itemNamePlaceholder), 'Hat');
    await userEvent.click(screen.getByRole('button', { name: en.packing.addItem }));
    await waitFor(() =>
      expect(addItemAction).toHaveBeenCalledWith({ categoryId: 'c1', name: 'Hat', quantity: 1 }),
    );
  });

  it('deletes an item', async () => {
    renderPacking();
    await screen.findByDisplayValue('Socks');
    await userEvent.click(screen.getByRole('button', { name: en.packing.deleteItem }));
    await waitFor(() => expect(deleteItemAction).toHaveBeenCalledWith('i1'));
  });

  it('deletes a category', async () => {
    renderPacking();
    await screen.findByText('Clothes');
    await userEvent.click(screen.getByRole('button', { name: /Delete Clothes/ }));
    await waitFor(() => expect(deleteCategoryAction).toHaveBeenCalledWith('c1'));
  });

  it('disables mutating controls when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    renderPacking();
    await screen.findByText('Clothes');
    expect(screen.getByRole('button', { name: en.packing.addCategory })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Packed: Socks/ })).toBeDisabled();
  });
});
