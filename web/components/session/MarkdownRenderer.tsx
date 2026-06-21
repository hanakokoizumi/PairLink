"use client";

import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

export function MarkdownRenderer({ content, className }: Props) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      data-theme={resolvedTheme}
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted/50",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isBlock = codeClass?.includes("language-");
            return isBlock ? (
              <code className={cn(codeClass, "font-mono text-xs")} {...props}>
                {children}
              </code>
            ) : (
              <code
                className="rounded bg-muted px-1 font-mono text-xs"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
