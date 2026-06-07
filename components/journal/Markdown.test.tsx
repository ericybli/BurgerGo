import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from '@/components/journal/Markdown';

describe('Markdown', () => {
  it('renders standard markdown formatting', () => {
    render(<Markdown source={'# Title\n\nSome **bold** and *italic* text.'} />);
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('renders GFM lists', () => {
    render(<Markdown source={'- one\n- two'} />);
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  it('hardens links with target/rel', () => {
    render(<Markdown source={'[ex](https://example.com)'} />);
    const link = screen.getByRole('link', { name: 'ex' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('strips a script / raw-HTML payload (sanitization)', () => {
    const { container } = render(
      <Markdown source={'hello <script>window.__x=1</script><img src=x onerror="window.__y=1">'} />,
    );
    // No executable script element survives.
    expect(container.querySelector('script')).toBeNull();
    // No event handler attribute survives on any rendered element.
    expect(container.querySelector('[onerror]')).toBeNull();
    // The benign text is still present.
    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });

  it('strips a javascript: link href (sanitization)', () => {
    const { container } = render(<Markdown source={'[x](javascript:alert(1))'} />);
    const anchor = container.querySelector('a');
    // rehype-sanitize drops the dangerous href entirely.
    expect(anchor?.getAttribute('href') ?? '').not.toContain('javascript:');
  });
});
