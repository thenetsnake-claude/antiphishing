/**
 * Type definitions for link-shorteners npm package
 * The package exports an object with a method to list shortener domains
 */
declare module 'link-shorteners' {
  interface LinkShorteners {
    listLinkShorterners(): string[];
  }
  const linkShorteners: LinkShorteners;
  export = linkShorteners;
}
