import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer - Renders markdown content with syntax highlighting
 * 
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Syntax highlighting for 30+ languages
 * - Copy button for code blocks
 * - Responsive styling matching the app theme
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('markdown-content', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom code block with syntax highlighting
          code: CodeBlock,
          // Custom styling for other elements
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mt-6 mb-3 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-white mt-5 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-white mt-4 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-300 leading-relaxed mb-3 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1 ml-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1 ml-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-300">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-council-primary/50 pl-4 italic text-gray-400 my-3">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-council-primary hover:text-council-secondary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-700 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-800">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold text-white border border-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-gray-300 border border-gray-700">
              {children}
            </td>
          ),
          hr: () => (
            <hr className="my-6 border-gray-700" />
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-200">{children}</em>
          ),
          del: ({ children }) => (
            <del className="line-through text-gray-500">{children}</del>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

// Code block component with syntax highlighting and copy button
function CodeBlock({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  const [copied, setCopied] = useState(false);
  
  // Detect language from className (e.g., "language-typescript")
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');
  
  // Check if this is an inline code or a code block
  const isInline = !match && !codeString.includes('\n');
  
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeString]);
  
  // Inline code styling
  if (isInline) {
    return (
      <code 
        className="px-1.5 py-0.5 rounded bg-gray-800 text-council-primary text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  }
  
  // Code block with syntax highlighting
  return (
    <div className="relative group my-4">
      {/* Language badge + copy button */}
      <div className="absolute top-0 right-0 flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400">
        {language && (
          <span className="uppercase tracking-wider">{language}</span>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0.75rem',
          padding: '1rem',
          paddingTop: '2.5rem', // Space for language badge
          fontSize: '0.875rem',
          background: '#1e1e2e',
        }}
        codeTagProps={{
          className: 'font-mono',
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

export default MarkdownRenderer;
