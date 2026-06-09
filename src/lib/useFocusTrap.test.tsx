import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from '@/src/lib/useFocusTrap';

function Trap({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <div>
      <button>before</button>
      <div ref={ref} role="dialog">
        <button>first</button>
        <button>middle</button>
        <button>last</button>
      </div>
      <button>after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus to the first focusable on activate', () => {
    render(<Trap />);
    expect(screen.getByText('first')).toHaveFocus();
  });

  it('wraps Tab at the boundaries and stays inside the dialog', async () => {
    render(<Trap />);
    const first = screen.getByText('first');
    const last = screen.getByText('last');

    // From the first element, Shift+Tab wraps to the last.
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();

    // From the last element, Tab wraps back to the first.
    await userEvent.tab();
    expect(first).toHaveFocus();
  });

  it('does nothing when inactive', () => {
    render(<Trap active={false} />);
    expect(screen.getByText('first')).not.toHaveFocus();
  });
});
