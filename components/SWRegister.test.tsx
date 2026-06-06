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
    // Reset readyState back to 'complete' (jsdom default) after each test.
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
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

  it('registers immediately when document.readyState is already "complete"', async () => {
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    render(<SWRegister />);
    // No load event fired — registration must happen synchronously within the effect.
    await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
    await waitFor(() => expect(persist).toHaveBeenCalled());
  });

  it('defers registration until the load event when document.readyState is "loading"', async () => {
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    render(<SWRegister />);
    // Not yet registered — page is still loading.
    expect(register).not.toHaveBeenCalled();
    // Fire the load event to trigger registration.
    window.dispatchEvent(new Event('load'));
    await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
    await waitFor(() => expect(persist).toHaveBeenCalled());
  });
});
