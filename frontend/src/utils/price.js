export function calculatePrice(startTime, endTime, rate) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const hours = Math.ceil((end - start) / (1000 * 60 * 60));
  return hours * rate;
}
