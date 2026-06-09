'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Root, Element } from 'hast';

/**
 * Sanitize schema (spec §4.1): the rehype-sanitize default (standard
 * inline/block formatting; raw HTML & scripts already dropped) plus the `a`
 * `target`/`rel` attributes we set below. Cloned so we never mutate the import.
 */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
  },
};

/** Force every anchor open in a new tab with a hardened rel (spec §4.1). */
function rehypeHardenLinks() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      const children = node.children ?? [];
      for (const child of children) {
        if (child.type === 'element') {
          if (child.tagName === 'a') {
            child.properties = {
              ...child.properties,
              target: '_blank',
              rel: 'noopener noreferrer',
            };
          }
          visit(child);
        }
      }
    };
    visit(tree);
  };
}

/** Render sanitized markdown source. Runs client-side so it works offline. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-journal text-body leading-relaxed text-ink [&_a]:text-coral [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors [&_a:hover]:text-coral-press [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-coral [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-muted [&_h1]:mt-5 [&_h1]:font-serif [&_h1]:text-heading [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:font-serif [&_h2]:text-heading [&_h2]:font-semibold [&_li]:ml-4 [&_li]:mt-1 [&_li]:list-disc [&_p]:mt-3 [&_strong]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema], rehypeHardenLinks]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
