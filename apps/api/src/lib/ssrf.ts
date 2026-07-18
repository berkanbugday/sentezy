import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard for the product-import scraper: it fetches URLs the user pastes AND URLs
 * discovered inside the scraped page, so every outbound fetch must be pinned to a public
 * destination. `safeFetch` validates the scheme, resolves the host and rejects any address
 * in a private/loopback/link-local/etc. range, and re-validates every redirect hop.
 *
 * Residual risk: DNS rebinding (the name resolves to a public IP for our check, then a
 * private IP when fetch connects) is not fully closed here — that needs socket pinning.
 * The resolve-and-block + manual-redirect approach blocks the common SSRF vectors.
 */

// CIDR = aligned network integer + prefix length.
type Cidr = { net: bigint; bits: number };

function v4ToInt(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0n;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = (n << 8n) | BigInt(b);
  }
  return n;
}

function v6ToInt(ip: string): bigint | null {
  let s = (ip.split("%")[0] ?? "").toLowerCase();
  // Expand an embedded IPv4 tail (e.g. ::ffff:1.2.3.4) into two hextets.
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = v4ToInt(tail);
    if (v4 === null) return null;
    const hi = (v4 >> 16n) & 0xffffn;
    const lo = v4 & 0xffffn;
    s = `${s.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const back = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - back.length;
  if (halves.length === 1 && head.length !== 8) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...back];
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    const h = parseInt(g || "0", 16);
    if (Number.isNaN(h) || h < 0 || h > 0xffff) return null;
    n = (n << 16n) | BigInt(h);
  }
  return n;
}

const mask = (bits: number, total: number): bigint =>
  bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(total - bits);

const inCidr = (ip: bigint, c: Cidr, total: number): boolean => (ip & mask(c.bits, total)) === c.net;

const cidrs = (list: Array<[string, number]>, toInt: (s: string) => bigint | null): Cidr[] =>
  list.map(([ip, bits]) => ({ net: toInt(ip)!, bits }));

// Private / special-use IPv4 ranges (RFC1918, loopback, link-local, CGNAT, multicast, …).
const BLOCKED_V4 = cidrs(
  [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
    ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
    ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4], ["255.255.255.255", 32],
  ],
  v4ToInt,
);

// Special-use IPv6 ranges (loopback, unspecified, ULA, link-local, multicast, documentation).
const BLOCKED_V6 = cidrs(
  [["::1", 128], ["::", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32]],
  v6ToInt,
);

// v4-in-v6 embeddings — validate the embedded v4 against the v4 blocklist too.
const V4_MAPPED = { net: v6ToInt("::ffff:0:0")!, bits: 96 } as Cidr; // ::ffff:0:0/96
const V4_TRANSLATED = { net: v6ToInt("64:ff9b::")!, bits: 96 } as Cidr; // 64:ff9b::/96

export function isBlockedIp(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) {
    const n = v4ToInt(ip);
    return n === null || BLOCKED_V4.some((c) => inCidr(n, c, 32));
  }
  if (fam === 6) {
    const n = v6ToInt(ip);
    if (n === null) return true;
    if (BLOCKED_V6.some((c) => inCidr(n, c, 128))) return true;
    // Unwrap embedded IPv4 and re-check it against the v4 rules.
    if (inCidr(n, V4_MAPPED, 128) || inCidr(n, V4_TRANSLATED, 128)) {
      const embedded = n & 0xffffffffn;
      return BLOCKED_V4.some((c) => inCidr(embedded, c, 32));
    }
    return false;
  }
  return true; // not a recognizable IP → refuse
}

/** Throw "blocked_url" unless the URL is http(s) and resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("blocked_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("blocked_url");
  const host = u.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  let addrs: string[];
  if (net.isIP(host)) {
    addrs = [host];
  } else {
    const looked = await dns.lookup(host, { all: true }).catch(() => []);
    addrs = looked.map((a) => a.address);
  }
  if (addrs.length === 0) throw new Error("blocked_url");
  for (const a of addrs) if (isBlockedIp(a)) throw new Error("blocked_url");
}

/**
 * fetch() that validates the destination (and each redirect hop) is a public http(s)
 * address. Throws "blocked_url" on a disallowed target — callers already treat a throw as
 * "skip this asset / no HTML".
 */
export async function safeFetch(url: string, init?: RequestInit, maxRedirects = 3): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("too_many_redirects");
}
