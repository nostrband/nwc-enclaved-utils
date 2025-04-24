import { SimplePool } from "nostr-tools";

export interface WalletService {
  pubkey: string;
  relays: string[];
  minSendable: number;
  maxSendable: number;
  maxBalance: number;
}

const DEFAULT_RELAYS = [
  "wss://relay.damus.io/",
  "wss://relay.primal.net/",
  "wss://relay.nostr.band/all",
];

const OUTBOX_RELAYS = [
  "wss://purplepag.es",
  "wss://relay.primal.net",
  "wss://relay.nostr.band/all",
  "wss://user.kindpag.es",
  "wss://relay.nos.social",
];

export function normalizeRelay(r: string) {
  try {
    const u = new URL(r);
    if (u.protocol !== "wss:" && u.protocol !== "ws:") return undefined;
    if (u.hostname.endsWith(".onion")) return undefined;
    if (u.hostname === "localhost") return undefined;
    if (u.hostname === "127.0.0.1") return undefined;
    return u.href;
  } catch {}
}

export async function discoverWalletServices(
  relays?: string[]
): Promise<WalletService[]> {
  relays = relays || DEFAULT_RELAYS;

  const pool = new SimplePool();
  const events = await pool.querySync(relays, {
    kinds: [13196],
    since: Math.floor(Date.now() / 1000) - 120,
    limit: 10,
  });

  // FIXME verify attestation etc
  const validEvents = events.filter(
    (e) => !!e.tags.find((t) => t.length > 1 && t[0] === "minSendable")
  );
  if (!validEvents.length) return [];

  const pubkeys = validEvents.map((e) => e.pubkey);
  const relayEvents = await pool.querySync(OUTBOX_RELAYS, {
    kinds: [10002],
    authors: pubkeys,
  });

  return validEvents
    .filter((e) => relayEvents.find((r) => r.pubkey === e.pubkey))
    .map((e) => ({
      pubkey: e.pubkey,
      maxSendable: Number(
        e.tags.find((t) => t.length > 1 && t[0] === "maxSendable")?.[1]
      ),
      minSendable: Number(
        e.tags.find((t) => t.length > 1 && t[0] === "minSendable")?.[1]
      ),
      maxBalance: Number(
        e.tags.find((t) => t.length > 1 && t[0] === "maxBalance")?.[1]
      ),
      event: e,
      relays: relayEvents
        .find((r) => r.pubkey === e.pubkey)!
        .tags.filter((t) => t.length > 1 && t[0] === "r")
        .map((t) => normalizeRelay(t[1]))
        .filter((r) => !!r),
    } as WalletService))
    .filter((s) => s.relays?.length > 0);
}
