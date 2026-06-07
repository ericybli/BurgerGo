import { describe, it, expect } from 'vitest';
import { entrySnippet, linkDomain } from '@/src/lib/journalView';

describe('entrySnippet', () => {
  it('returns plain text unchanged when short and unformatted', () => {
    expect(entrySnippet('A quiet day in the park.')).toBe(
      'A quiet day in the park.',
    );
  });

  it('strips heading hashes', () => {
    expect(entrySnippet('# Day One\nWe arrived.')).toBe('Day One We arrived.');
  });

  it('strips bold/italic asterisks and underscores', () => {
    expect(entrySnippet('It was **really** _great_ today.')).toBe(
      'It was really great today.',
    );
  });

  it('strips inline code backticks', () => {
    expect(entrySnippet('Run `npm run dev` first.')).toBe(
      'Run npm run dev first.',
    );
  });

  it('reduces markdown links to their text', () => {
    expect(entrySnippet('See [the map](https://maps.example.com) here.')).toBe(
      'See the map here.',
    );
  });

  it('collapses runs of whitespace and newlines to single spaces', () => {
    expect(entrySnippet('Line one\n\n  Line   two')).toBe('Line one Line two');
  });

  it('truncates to the default 140 chars with a trailing ellipsis', () => {
    const long = 'a'.repeat(200);
    const out = entrySnippet(long);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(141); // 140 chars + the ellipsis
    expect(out.slice(0, 140)).toBe('a'.repeat(140));
  });

  it('honors a custom maxLen', () => {
    expect(entrySnippet('abcdefghij', 5)).toBe('abcde…');
  });

  it('does not append an ellipsis when exactly at the limit', () => {
    expect(entrySnippet('abcde', 5)).toBe('abcde');
  });

  it('returns an empty string for an empty body', () => {
    expect(entrySnippet('')).toBe('');
  });
});

describe('linkDomain', () => {
  it('returns the hostname for a normal URL', () => {
    expect(linkDomain('https://example.com/path?q=1')).toBe('example.com');
  });

  it('strips a leading www.', () => {
    expect(linkDomain('https://www.example.com/post')).toBe('example.com');
  });

  it('lowercases the host', () => {
    expect(linkDomain('https://Example.COM/x')).toBe('example.com');
  });

  it('keeps non-www subdomains', () => {
    expect(linkDomain('https://blog.example.com')).toBe('blog.example.com');
  });

  it('returns empty string for unparseable input', () => {
    expect(linkDomain('not a url')).toBe('');
    expect(linkDomain('')).toBe('');
  });
});
