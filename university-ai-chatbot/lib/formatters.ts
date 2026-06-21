export function formatValue(value: string): string {
  return value
    .replace(/\bRs\.?\s*/gi, "₹")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatFee(value: string): string {
  const numericString = value.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0];
  if (!numericString) return formatValue(value);

  const num = parseFloat(numericString);
  if (num >= 100000) {
    const lakhs = num / 100000;
    let formatted = lakhs.toFixed(2).replace(/0$/, "");
    if (formatted.endsWith(".")) {
      formatted += "0";
    }
    return `₹${formatted}L/year`;
  }

  const formattedNum = num.toLocaleString("en-IN");
  return `₹${formattedNum}/year`;
}

export function limitWords(value: string, maxWords: number): string {
  const words = value.split(/\s+/);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}...` : value;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
