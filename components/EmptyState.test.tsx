import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders headline, subtext, and mascot', () => {
    render(
      <EmptyState
        mascotAlt="BurgerGo the Siamese cat"
        headline="Where to first?"
        subtext="Plan your first trip and BurgerGo will tag along."
      />,
    );
    expect(screen.getByText('Where to first?')).toBeInTheDocument();
    expect(
      screen.getByText('Plan your first trip and BurgerGo will tag along.'),
    ).toBeInTheDocument();
    const img = screen.getByAltText('BurgerGo the Siamese cat') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/burgergo-logo.png');
  });

  it('renders no button when no action is given', () => {
    render(<EmptyState mascotAlt="cat" headline="Empty" subtext="Nothing here" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fires the action handler when the CTA is clicked', async () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        mascotAlt="cat"
        headline="Empty"
        subtext="Nothing here"
        actionLabel="New trip"
        onAction={onAction}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'New trip' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
