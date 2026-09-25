/**
 * Turns a label into a camelCase id, e.g. "Date of birth" -> "dateOfBirth".
 *
 * Call this only when an object or field is first created; the resulting id
 * is stored in the schema file and must never be regenerated, even if the
 * label later changes.
 *
 * Rules: accents are stripped ("Café" -> "cafe"), words are split on any
 * character that is not an ASCII letter or digit, and the words are joined in
 * camelCase. Throws if the result is empty or starts with a digit.
 */
export function generateId(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  const id = words
    .map((word, i) => {
      const lower = word.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");

  if (id === "") {
    throw new Error(`Label "${label}" has no letters or digits to build an id from`);
  }
  if (/^[0-9]/.test(id)) {
    throw new Error(`Label "${label}" produces id "${id}", which starts with a digit`);
  }
  return id;
}
