export function getCurrentTime(): string {
  return new Date().toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "full",
    timeStyle: "medium",
  });
}
