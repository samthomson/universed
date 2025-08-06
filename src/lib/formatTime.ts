import { formatDistanceToNow } from "date-fns";

/**
 * Custom distance formatter that returns abbreviated time formats
 * Examples: "5m ago", "about 2h ago", "1d ago", "about 2mo ago"
 */
export function formatDistanceToNowShort(
  date: Date | number,
  options?: { addSuffix?: boolean },
): string {
  const result = formatDistanceToNow(date, {
    addSuffix: options?.addSuffix ?? true,
    // Use a custom rounding strategy to get cleaner abbreviations
  });

  // Replace full words with abbreviations
  return result
    .replace(/about\s+/g, "about ") // Keep "about" for approximate times
    .replace(/less than a minute ago/, "just now")
    .replace(/less than /, "<")
    .replace(/(\d+)\s+minutes?/g, "$1m")
    .replace(/(\d+)\s+hours?/g, "$1h")
    .replace(/(\d+)\s+days?/g, "$1d")
    .replace(/(\d+)\s+weeks?/g, "$1w")
    .replace(/(\d+)\s+months?/g, "$1mo")
    .replace(/(\d+)\s+years?/g, "$1y")
    .replace(/over\s+(\d+)\s+years?/g, "$1+y")
    .replace(/about\s+/g, "");
}
