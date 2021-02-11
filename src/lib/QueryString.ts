export function parseQueryString(query: string): { state?: string, code?: string, invitation?: string } {
  const searchParams = new URLSearchParams(query);
  return [...searchParams.entries()].reduce((obj, e) => ({...obj, [e[0]]: e[1]}), {});
}
