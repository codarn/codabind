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
    id: "quad9",
    name: "Quad9",
    region: "Anycast (CH)",
    url: (n, t) => `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(n)}&type=${encodeURIComponent(t)}`,
    acceptHeader: "application/dns-json",
  },
  {
    id: "dnssb",
    name: "DNS.SB",
    region: "Anycast (SG)",
    url: (n, t) => `https://doh.dns.sb/dns-query?name=${encodeURIComponent(n)}&type=${encodeURIComponent(t)}`,
    acceptHeader: "application/dns-json",
  },
];

export const RESOLVER_HOSTS = [
  "https://cloudflare-dns.com",
  "https://dns.google",
  "https://dns.quad9.net:5053",
  "https://doh.dns.sb",
] as const;
