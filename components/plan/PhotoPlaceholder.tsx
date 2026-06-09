import { categoryGlyph } from '@/src/lib/planUrl';
import type { PlaceDTO } from '@/src/lib/planView';

type PhotoPlaceholderProps = {
  /** Category whose glyph is centered on the stripes. */
  category: PlaceDTO['category'];
  /** Height utility, defaults to the list-card photo height (h-40). */
  className?: string;
};

/**
 * Fallback shown in a card's photo slot when a place has no photo: soft diagonal
 * stripes (bg-card-placeholder) over paper with the category glyph centered and
 * faded. Keeps cards visually even whether or not a photo exists, instead of an
 * empty gap. Decorative only, so it's aria-hidden.
 */
export function PhotoPlaceholder({ category, className = 'h-40' }: PhotoPlaceholderProps) {
  return (
    <span
      aria-hidden="true"
      className={`mb-2 flex w-full items-center justify-center rounded-control bg-paper bg-card-placeholder shadow-inset ${className}`}
    >
      <span className="text-5xl opacity-30">{categoryGlyph(category)}</span>
    </span>
  );
}
