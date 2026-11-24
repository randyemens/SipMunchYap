// Contact & location icons filled with the shared sunset gradient (see globals.css).
// Same idea as the logo bubble: a `bg-sunset` box cut to the icon's shape by a mask.
// The shapes are the lucide icons saved as plain SVGs in public/icons/.
export type SunsetIconName = "map-pin" | "phone" | "globe";

export function SunsetIcon({
  name,
  className = "",
}: {
  name: SunsetIconName;
  className?: string;
}) {
  const mask = `url(/icons/${name}.svg)`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-sunset ${className}`}
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
