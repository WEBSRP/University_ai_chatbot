export type SourceLink = {
  title: string;
  url: string;
};

export function sourceTitleFromUrl(url: string): string {
  const fallback = "Official Source";

  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.split("/").filter(Boolean).pop();

    if (!slug) {
      return fallback;
    }

    return slug
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return fallback;
  }
}
