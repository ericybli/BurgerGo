import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { PhotoGallery } from './PhotoGallery';

type P = { id: string; width: number | null; height: number | null };

function renderGallery(props: Partial<React.ComponentProps<typeof PhotoGallery>> = {}) {
  const onDelete = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PhotoGallery
        photos={[{ id: 'ph1', width: 800, height: 600 }, { id: 'ph2', width: 800, height: 600 }] as P[]}
        placeName="Castle"
        disabled={false}
        onDelete={onDelete}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onDelete };
}

describe('PhotoGallery', () => {
  it('renders a thumbnail per photo using the personal-photo thumb URL', () => {
    renderGallery();
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('src', '/api/photos/p/ph1/thumb');
    expect(imgs[1]).toHaveAttribute('src', '/api/photos/p/ph2/thumb');
  });

  it('renders nothing when there are no photos', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PhotoGallery photos={[]} placeName="Castle" disabled={false} onDelete={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a full-screen viewer (full size) when a thumbnail is tapped, and closes it', async () => {
    renderGallery();
    await userEvent.click(screen.getAllByRole('button', { name: /Castle/ })[0]!);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    const full = screen.getByAltText(en.plan.photoOf.replace('{name}', 'Castle'));
    expect(full).toHaveAttribute('src', '/api/photos/p/ph1/full');
    await userEvent.click(screen.getByRole('button', { name: en.plan.closePhoto }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onDelete with the photo id when its delete control is used', async () => {
    const { onDelete } = renderGallery();
    await userEvent.click(screen.getAllByRole('button', { name: en.plan.deletePhoto })[0]!);
    expect(onDelete).toHaveBeenCalledWith('ph1');
  });

  it('disables delete controls when offline', () => {
    renderGallery({ disabled: true });
    for (const btn of screen.getAllByRole('button', { name: en.plan.deletePhoto })) {
      expect(btn).toBeDisabled();
    }
  });
});
