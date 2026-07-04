/** Detect copy that is mostly English (not suitable for default Somali WhatsApp replies). */
export function isPredominantlyEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const somaliMarkers =
    /\b(waxaan|waxa|ku soo|adeeg|shirkad|mahadsanid|fadlan|macmiil|sidee|caawin|dhawoow|soo dhawoow)\b/i;
  if (somaliMarkers.test(trimmed)) return false;

  const letters = trimmed.match(/[a-zA-Z]/g)?.length ?? 0;
  const nonSpace = trimmed.replace(/\s/g, '').length;
  if (nonSpace < 10) return false;

  return letters / nonSpace > 0.75;
}

/** True for generic English greetings stored before Somali-first defaults. */
export function isGenericEnglishGreeting(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const lower = text.trim().toLowerCase();
  return (
    lower.startsWith('hello!') ||
    lower.startsWith('hello ') ||
    lower === 'hello' ||
    /^welcome to .+! how can i help/i.test(lower)
  );
}
