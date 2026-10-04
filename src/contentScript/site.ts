export const siteHostname = ({
  href,
  ancestorOrigins,
  referrer,
}: {
  href: string;
  ancestorOrigins: readonly string[];
  referrer: string;
}) => {
  const hostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  };
  const ownHostname = hostname(href);
  if (ownHostname || !/^about:(?:blank|srcdoc)(?:[?#]|$)/.test(href)) return ownHostname;
  // Blank editor frames inherit their embedding site's preferences.
  return ancestorOrigins.map(hostname).find(Boolean) || hostname(referrer);
};
