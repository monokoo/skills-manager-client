import { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { skillSanitizeSchema } from '../../lib/markdownSanitize';
import { parseFrontmatter, stripBadgeLines } from '../../lib/markdownUtils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rehypePlugins: any[] = [rehypeRaw, [rehypeSanitize, skillSanitizeSchema]];

interface MarkdownContentProps {
  content: string;
  /** When true, strip badge images and social links from the rendered output */
  stripBadges?: boolean;
}

/**
 * Shared Markdown renderer for SKILL.md content.
 * Parses YAML frontmatter into a metadata table and renders
 * the remaining body as GFM-flavored Markdown with HTML sanitization.
 */
export function MarkdownContent({ content, stripBadges = false }: MarkdownContentProps) {
  const { meta, body } = useMemo(() => parseFrontmatter(content), [content]);
  const processedBody = useMemo(() => (stripBadges ? stripBadgeLines(body) : body), [body, stripBadges]);
  const metaEntries = Object.entries(meta);

  return (
    <>
      {metaEntries.length > 0 && (
        <div className="frontmatter-wrapper">
          <table className="frontmatter-table">
            <tbody>
              {metaEntries.map(([key, value]) => (
                <tr key={key}>
                  <td className="frontmatter-key">{key}</td>
                  <td className="frontmatter-value">
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>{value}</Markdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>{processedBody}</Markdown>
    </>
  );
}
