export function isValidImageSrc(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    (value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("/") ||
      value.startsWith("data:"))
  );
}

export function getValidImageSrc(value: unknown): string | undefined {
  if (isValidImageSrc(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    // Development-only assertion/log to identify where invalid images are coming from
    if (process.env.NODE_ENV === "development") {
      console.warn("Invalid image source provided:", value);
    }
  }
  return undefined;
}
