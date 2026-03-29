import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type MarkdownTone = "assistant" | "thinking" | "user";

interface MarkdownContentProps {
  content: string;
  tone: MarkdownTone;
  className?: string;
}

const baseClassName = [
  "min-w-0",
  "break-words",
  "[&_p]:mb-3",
  "[&_p:last-child]:mb-0",
  "[&_ul]:mb-3",
  "[&_ul]:list-disc",
  "[&_ul]:pl-5",
  "[&_ol]:mb-3",
  "[&_ol]:list-decimal",
  "[&_ol]:pl-5",
  "[&_li]:mb-1",
  "[&_li:last-child]:mb-0",
  "[&_h1]:mb-3",
  "[&_h1]:text-[1.05em]",
  "[&_h1]:font-semibold",
  "[&_h2]:mb-3",
  "[&_h2]:text-[1.02em]",
  "[&_h2]:font-semibold",
  "[&_h3]:mb-2",
  "[&_h3]:font-semibold",
  "[&_blockquote]:mb-3",
  "[&_blockquote]:border-l-2",
  "[&_blockquote]:pl-3",
  "[&_blockquote]:italic",
  "[&_hr]:my-4",
  "[&_hr]:border-0",
  "[&_hr]:border-t",
  "[&_a]:font-semibold",
  "[&_a]:underline",
  "[&_a]:underline-offset-4",
  "[&_img]:max-w-full",
  "[&_img]:rounded-[14px]",
  "[&_pre]:mb-3",
  "[&_pre]:overflow-x-auto",
  "[&_pre]:rounded-[14px]",
  "[&_pre]:px-3",
  "[&_pre]:py-2.5",
  "[&_pre]:text-[13px]",
  "[&_pre_code]:bg-transparent",
  "[&_pre_code]:p-0",
  "[&_code]:rounded-[6px]",
  "[&_code]:px-1.5",
  "[&_code]:py-0.5",
  "[&_code]:font-mono",
  "[&_code]:text-[0.92em]",
  "[&_table]:w-full",
  "[&_table]:min-w-[320px]",
  "[&_table]:border-collapse",
  "[&_th]:border-b",
  "[&_th]:px-2",
  "[&_th]:py-2",
  "[&_th]:text-left",
  "[&_th]:font-semibold",
  "[&_td]:border-b",
  "[&_td]:px-2",
  "[&_td]:py-2",
  "[&_td]:align-top"
].join(" ");

const toneClassName: Record<MarkdownTone, string> = {
  assistant: [
    "text-ink-950",
    "[&_blockquote]:border-accent-500/[0.3]",
    "[&_hr]:border-ink-950/10",
    "[&_a]:text-accent-500",
    "[&_pre]:bg-ink-950",
    "[&_pre]:text-white/[0.94]",
    "[&_code]:bg-ink-950/[0.07]",
    "[&_th]:border-ink-950/10",
    "[&_td]:border-ink-950/8"
  ].join(" "),
  thinking: [
    "text-amber-950/90",
    "[&_blockquote]:border-amber-700/[0.24]",
    "[&_hr]:border-amber-700/[0.14]",
    "[&_a]:text-amber-800",
    "[&_pre]:bg-amber-950/[0.09]",
    "[&_pre]:text-amber-950",
    "[&_code]:bg-amber-950/[0.08]",
    "[&_th]:border-amber-700/[0.14]",
    "[&_td]:border-amber-700/[0.1]"
  ].join(" "),
  user: [
    "text-white",
    "[&_blockquote]:border-white/[0.28]",
    "[&_hr]:border-white/[0.16]",
    "[&_a]:text-white",
    "[&_pre]:bg-black/[0.18]",
    "[&_pre]:text-white/[0.94]",
    "[&_code]:bg-white/[0.14]",
    "[&_th]:border-white/[0.2]",
    "[&_td]:border-white/[0.16]"
  ].join(" ")
};

const markdownComponents: Components = {
  a({ node, ...props }) {
    return <a {...props} target="_blank" rel="noreferrer" />;
  },
  table({ node, ...props }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table {...props} />
      </div>
    );
  }
};

export function MarkdownContent({ content, tone, className }: MarkdownContentProps) {
  return (
    <div className={[baseClassName, toneClassName[tone], className].filter(Boolean).join(" ")}>
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
