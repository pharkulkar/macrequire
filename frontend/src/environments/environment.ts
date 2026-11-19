const API_URL = 'http://localhost:4000/api';
/**
 * While developing, the API address is "localhost". Opened from another device on your network (for example
 * http://192.168.1.20:4200), "localhost" would point at that device, so the page's own host name is used instead.
 * Anything other than a localhost API address (a real deployment) is used exactly as written.
 */
const apiUrl = (() => {
  if (typeof window === 'undefined' || new URL(API_URL).hostname !== 'localhost') return API_URL;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' ? API_URL : `${window.location.protocol}//${host}:4000/api`;
})();

export const environment = {
  apiUrl,
  /** Countries shoppers can choose. The first is the default. The backend and data model also support 'IN'. */
  countries: ['US'] as ('US' | 'IN')[],
  siteName: 'MacRequire',
  /**
   * Public origin of the website, with no trailing slash. Used for canonical URLs, the sitemap and social cards.
   * The server can override it at runtime with the SITE_URL environment variable (see server.ts).
   */
  siteUrl: 'http://localhost:4200',
  /** Shown on the legal pages. Set a real, monitored address before launch. */
  contactEmail: '',
  /** Optional search-engine ownership tokens (the content value of the verification meta tag). */
  googleSiteVerification: '',
  bingSiteVerification: '',
};
