export function xmlEscape(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlUnescape(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function firstXmlMatch(text: string, regex: RegExp) {
  return text.match(regex)?.[1];
}

export function parseWsfeErrors(response: string) {
  return [...response.matchAll(/<Err>\s*<Code>([\s\S]*?)<\/Code>\s*<Msg>([\s\S]*?)<\/Msg>\s*<\/Err>/g)]
    .map((match) => ({ code: match[1], message: match[2] }));
}
