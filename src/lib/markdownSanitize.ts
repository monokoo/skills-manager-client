import { defaultSchema } from 'rehype-sanitize';
import type { Options as SanitizeOptions } from 'rehype-sanitize';

/**
 * Sanitize schema for rendering third-party SKILL.md content.
 * Allows common HTML elements but strips scripts, iframes, and event handlers.
 * Must be used AFTER rehype-raw in the plugin chain.
 */
export const skillSanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class on code elements (syntax highlighting)
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className'],
    // Allow common img attributes
    img: ['src', 'alt', 'title', 'width', 'height'],
    // Allow anchor attributes
    a: ['href', 'title', 'target', 'rel'],
    // Allow table alignment
    td: ['align', 'colSpan', 'rowSpan'],
    th: ['align', 'colSpan', 'rowSpan'],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    // Ensure details/summary are allowed for collapsible sections
    'details', 'summary',
  ].filter(tag => !['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'].includes(tag)),
};
