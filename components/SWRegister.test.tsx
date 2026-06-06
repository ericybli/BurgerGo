import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SWRegister } from './SWRegister';

describe('SWRegister', () => {
  const register = vi.fn().mockResolvedValue({ scope: '/' });
  const persist = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      serviceWorker: { register },
      storage: { persist },
    });
    register.mockClear();
    persist.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing', () => {
    const { container } = render(<SWRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  it('registers /sw.js and requests persistent storage after window load', async () => {
    render(<SWRegister />);
    window.dispatchEvent(new Event('load'));
    await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
    await waitFor(() => expect(persist).toHaveBeenCalled());
  });

  it('does not throw when service workers are unavailable', () => {
    vi.stubGlobal('navigator', {});
    expect(() => {
      render(<SWRegister />);
      window.dispatchEvent(new Event('load'));
    }).not.toThrow();
  });
});
