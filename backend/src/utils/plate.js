export function normalizePlate(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

export function isNormalizedPlateEqual(a, b) {
  return normalizePlate(a) !== "" && normalizePlate(a) === normalizePlate(b);
}
