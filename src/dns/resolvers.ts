export interface DohResolver {
  id: string;
  name: string;
  region: string;
  url: (name: string, type: string) => string;
  acceptHeader: string;
}

export const DEFAULT_RESOLVERS: DohResolver[] = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    region: "Anycast (US)",
    url: (n, t) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(n)}&type=${encodeURIComponent(t)}`,
    acceptHeader: "application/dns-json",
  },
  {
    id: "google",
    name: "Google",
    region: "Anycast (US)",
    url: (n, t) => `https://dns.google/resolve?name=${encodeURIComponent(n)}&type=${encodeURIComponent(t)}`,
    acceptHeader: "application/dns-json",
  },
  {
    id: "dnssb",
    name: "DNS.SB",
    region: "Anycast (SG)",
    url: (n, t) => `https://doh.dns.sb/dns-query?name=${encodeURIComponent(n)}&type=${encodeURIComponent(t)}`,
    acceptHeader: "application/dns-json",
  },
  {
    id: "alidns",
    name: "AliDNS",
    region: "Anycast (CN)",
    url: (n, t) => `https://dns.alidns.com/resolve?name=${encodeURIComponent(n)}&type=${encodeURIComponent(t)}`,
    acceptHeader: "application/dns-json",
  },
  {
    id: "rethink",
    name: "Rethink DNS",
    region: "Anycast (IN)",
    url: (n, t) => `https://basic.rethinkdns.com/dns-query?name=${encodeURIComponent(n)}&type=${encodeURIComponent(t)}`,
    acceptHeader: "application/dns-json",
  },
];

export const RESOLVER_HOSTS = [
  "https://cloudflare-dns.com",
  "https://dns.google",
  "https://doh.dns.sb",
  "https://dns.alidns.com",
  "https://basic.rethinkdns.com",
] as const;
