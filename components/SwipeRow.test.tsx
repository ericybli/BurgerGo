import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwipeRow } from '@/components/SwipeRow';

// Note: the pointer-drag gesture itself isn't unit-tested — jsdom doesn't fire
// React's pointer handlers (no real PointerEvent), so the drag-to-reveal +
// click-swallow are verified in a live browser. These cover the non-gesture
// contract: the row + actions render, a tap reaches the row, actions fire.

describe('SwipeRow', () => {
  it('renders the row + actions, and a plain tap passes through to the row', async () => {
    const onRow = vi.fn();
    render(
      <SwipeRow actions={[{ label: 'Edit', onClick: vi.fn() }]}>
        <button onClick={onRow}>Row</button>
      </SwipeRow>,
    );
    expect(screen.getByText('Row')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Row'));
    expect(onRow).toHaveBeenCalled();
  });

  it('fires a revealed action when tapped', async () => {
    const onDelete = vi.fn();
    render(
      <SwipeRow actions={[{ label: 'Delete', onClick: onDelete, danger: true }]}>
        <button>Row</button>
      </SwipeRow>,
    );
    await userEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });
});
