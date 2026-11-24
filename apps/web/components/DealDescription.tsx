import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// The deal editor's toolbar writes Markdown plus a few HTML tags (<u>, <small>).
// Raw HTML is parsed, then sanitized so only these tags survive.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "small", "s"],
};

// The section header already says "Happy Hour", so the phrase is removed from deal titles (not descriptions).
const HAPPY_HOUR_GLOBAL = /\bhappy\s+hours?\b/gi;
const HAPPY_HOUR_ANY = /\bhappy\s+hours?\b/i;
const LIST_BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/;
// Emphasis or markup pairs left empty by the removal, e.g. "****" or "**:**".
const EMPTY_EMPHASIS = /(\*\*|__|~~|\*|_)\s*[\s:|,.\-–—]*\s*\1/g;
const EMPTY_TAG = /<(u|s|small|b|i|em|strong)>\s*<\/\1>/gi;

function cleanLineBody(body: string): string {
  let s = body.replace(HAPPY_HOUR_GLOBAL, "");
  let previous: string;
  do {
    previous = s;
    s = s.replace(EMPTY_EMPHASIS, "").replace(EMPTY_TAG, "").replace(/^\s*#{1,6}\s*$/, "");
  } while (s !== previous);
  s = s
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:|,–—-]+/, "")
    .replace(/[\s:|,–—-]+$/, "")
    .trim();
  // Nothing readable left (only markup or punctuation) means the line goes away.
  return /[a-z0-9]/i.test(s.replace(/<[^>]+>|[*_~#]/g, "")) ? s : "";
}

function stripHappyHour(text: string): string {
  if (!HAPPY_HOUR_ANY.test(text)) return text;
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (!HAPPY_HOUR_ANY.test(line)) {
      lines.push(line);
      continue;
    }
    const bullet = LIST_BULLET.exec(line)?.[0] ?? "";
    const cleaned = cleanLineBody(line.slice(bullet.length));
    lines.push(cleaned ? bullet + cleaned : "");
  }
  // Collapse the blank runs left by removed lines and trim the ends.
  const result: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (result.length > 0 && result[result.length - 1]!.trim() !== "") result.push("");
    } else {
      result.push(line);
    }
  }
  while (result.length > 0 && result[result.length - 1]!.trim() === "") result.pop();
  return result.join("\n");
}

// Same line handling as the old app: every line becomes its own paragraph,
// and blank lines become a visible spacer.
function preprocessMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() === "" ? "\n&nbsp;\n" : line.trim()))
    .join("\n\n");
}

function isSpacerChildren(children: ReactNode): boolean {
  const text = Array.isArray(children) ? children.join("") : children;
  return typeof text === "string" && text.replace(/\u00a0|&nbsp;/g, "").trim() === "";
}

const components: Components = {
  p: ({ children }) =>
    isSpacerChildren(children) ? (
      <div className="h-4" aria-hidden="true" />
    ) : (
      <p className="mb-0 break-words leading-normal">{children}</p>
    ),
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  u: ({ children }) => <u className="underline">{children}</u>,
  s: ({ children }) => <s className="line-through">{children}</s>,
  del: ({ children }) => <del className="line-through">{children}</del>,
  h1: ({ children }) => (
    <h1 className="mb-1 break-words text-lg font-bold leading-normal">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1 break-words text-base font-bold leading-normal">{children}</h2>
  ),
  small: ({ children }) => (
    <small className="break-words text-xs leading-normal">{children}</small>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="break-all text-link underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

export function DealDescription({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const cleaned = text ?? "";
  if (!cleaned.trim()) return null;
  return (
    <div className={`break-words ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {preprocessMarkdown(cleaned)}
      </ReactMarkdown>
    </div>
  );
}

/**
 * The deal title minus "happy hour" (the section header already says it).
 * Renders nothing when the title was only "Happy Hour".
 */
export function DealTitle({
  text,
  className,
  as: Tag = "h3",
}: {
  text: string | null | undefined;
  className?: string;
  as?: "h3" | "h4";
}) {
  const cleaned = stripHappyHour(text ?? "").trim();
  if (!cleaned) return null;
  return <Tag className={className}>{cleaned}</Tag>;
}
