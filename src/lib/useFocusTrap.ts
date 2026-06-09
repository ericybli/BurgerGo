import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus inside `ref` while `active` (spec §U4 a11y). On open it moves
 * focus to the first focusable descendant; Tab / Shift+Tab cycle within the container
 * instead of leaking to the page behind the modal; on close/unmount it restores focus
 * to whatever was focused before. Pair with the dialog's existing Escape-to-close and
 * `aria-modal` so sheets are keyboard- and screen-reader-safe.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const items = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Move focus into the dialog on open.
    items()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables = items();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !container?.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !container?.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Restore focus to the trigger so keyboard users aren't dropped at the page top.
      previouslyFocused?.focus?.();
    };
  }, [ref, active]);
}
