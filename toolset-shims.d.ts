// Ambient module declarations for browser-only tool libraries that ship no
// TypeScript types. These are used by the /tools module and are safe to
// treat as loosely typed at the boundary (conversion happens client-side).

declare module "turndown" {
  interface TurndownServiceOptions {
    headingStyle?: "setext" | "atx";
    hr?: string;
    bulletListMarker?: "-" | "+" | "*";
    codeBlockStyle?: "indented" | "fenced";
    fence?: string;
    emDelimiter?: "_" | "*";
    strongDelimiter?: "__" | "**";
    linkStyle?: "inlined" | "referenced";
    linkReferenceStyle?: "full" | "collapsed" | "shortcut";
    [key: string]: unknown;
  }

  export default class TurndownService {
    constructor(options?: TurndownServiceOptions);
    turndown(input: string | Node): string;
    use(plugin: (service: TurndownService) => void): TurndownService;
    addRule(key: string, rule: Record<string, unknown>): TurndownService;
    remove(filters: unknown): TurndownService;
  }
}
