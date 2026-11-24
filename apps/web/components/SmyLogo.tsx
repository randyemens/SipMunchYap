// Logo = speech bubble + wordmark text.
// The bubble is the shape in public/brand/smy-logo.svg used as a mask, filled by
// the shared `bg-sunset` gradient (see globals.css), so it lines up with the
// sunset buttons. The wordmark is plain text so it's easy to change: edit
// WORDMARK_LINES or the classes below. Sizes use container query units (cqw), so
// the whole logo scales with the width set by `className` on the root element.
const WORDMARK_LINES = ["SIP.", "MUNCH.", "YAP!"];

const BUBBLE_MASK = "url(/brand/smy-logo.svg?v=5)";

export function SmyLogo({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label={WORDMARK_LINES.join(" ")}
      className={`@container flex items-center gap-[.5cqw] ${className}`}
    >
      <div
        aria-hidden="true"
        className="aspect-[300/249] w-[49.1cqw] shrink-0 bg-sunset"
        style={{
          maskImage: BUBBLE_MASK,
          WebkitMaskImage: BUBBLE_MASK,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden="true"
        className="min-w-0 flex-1 -translate-y-[2cqw] font-sans text-[10.5cqw] font-black uppercase leading-[0.93] tracking-wide"
      >
        {WORDMARK_LINES.map((line) => (
          <div key={line} className="whitespace-nowrap">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
