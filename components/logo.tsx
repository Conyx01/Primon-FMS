import Image from "next/image";
import { cn } from "@/lib/utils";

export function PrimonLogo({
  className,
  width = 220,
  variant = "color",
}: {
  className?: string;
  width?: number;
  /** `onDark` uses the white wordmark for navy backgrounds. */
  variant?: "color" | "onDark";
}) {
  return (
    <Image
      src={variant === "onDark" ? "/Primon-logo.png" : "/logo.png"}
      alt="Primon Enterprises Ltd — Setting Standard in Pest Management Services"
      width={width}
      height={Math.round((width * 242) / 858)}
      className={cn("object-contain", className)}
      priority
    />
  );
}

export function PrimonMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontStyle="italic"
        fontSize="22"
        fill="currentColor"
      >
        PE
      </text>
    </svg>
  );
}
