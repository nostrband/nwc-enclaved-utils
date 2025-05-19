import {
  Event,
  Filter,
  SimplePool,
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";
import { Validator } from "nostr-enclaves";

export interface WalletService {
  pubkey: string;
  relays: string[];
  minSendable: number;
  maxSendable: number;
  maxBalance: number;
}

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

async function fetchEvents(relays: string[], filter: Filter) {
  const pool = new SimplePool();
  try {
    return await pool.querySync(relays, filter);
  } finally {
    pool.close(relays);
  }
}

export async function discoverWalletServices(opts?: {
  relays?: string[];
  maxBalance?: number;
}): Promise<WalletService[]> {
  let { relays, maxBalance } = opts || {};

  const DEFAULT_INFO_RELAYS = [
    "wss://relay.nos.social",
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://relay.nostr.band/all",
  ];

  relays = relays || DEFAULT_INFO_RELAYS;

  const events = await fetchEvents(relays, {
    kinds: [13196],
    "#o": ["true"],
    // FIXME only select prod instances
    "#t": ["prod", "dev"],
    since: Math.floor(Date.now() / 1000) - 30 * 60, // last 30 minutes
    limit: 10,
  });

  const tag = (e: Event, name: string) =>
    e.tags.find((t) => t.length > 1 && t[0] === name)?.[1];

  const validator = new Validator();
  const validEvents = events
    .filter(
      // minimal semantic check
      (e) =>
        !!tag(e, "minSendable") && !!tag(e, "relay") && tag(e, "o") === "true"
    )
    .filter((e) => validator.validateEnclavedEvent(e));
  if (!validEvents.length) return [];

  return validEvents
    .map(
      (e) =>
        ({
          pubkey: e.pubkey,
          maxSendable: Number(tag(e, "maxSendable")),
          minSendable: Number(tag(e, "minSendable")),
          maxBalance: Number(tag(e, "maxBalance")),
          liquidityFeeRate: Number(tag(e, "liquidityFeeRate")),
          paymentFeeRate: Number(tag(e, "paymentFeeRate")),
          paymentFeeBase: Number(tag(e, "paymentFeeBase")),
          walletFeeBase: Number(tag(e, "walletFeeBase")),
          walletFeePeriod: Number(tag(e, "walletFeePeriod")),
          open: tag(e, "o") === "true",
          enclave: tag(e, "t"),
          event: e,
          relays: e.tags
            .filter((t) => t.length > 1 && t[0] === "relay")
            .map((t) => normalizeRelay(t[1]))
            .filter((r) => !!r),
        } as WalletService)
    )
    .filter((s) => s.relays?.length > 0)
    .filter((s) => !maxBalance || s.maxBalance >= maxBalance);
}

export async function createWallet(maxBalance?: number) {
  const services = await discoverWalletServices({ maxBalance });
  if (!services.length) throw new Error("Failed to find a wallet service");

  const service = services[0];
  const walletPrivkey = generateSecretKey();

  const clientPublicKey = getPublicKey(walletPrivkey);
  const lnAddress = `${nip19.npubEncode(clientPublicKey)}@${nip19.npubEncode(
    service.pubkey
  )}.zap.land`;

  const nwcString = `nostr+walletconnect://${service.pubkey}?relay=${
    service.relays[0]
  }&secret=${bytesToHex(walletPrivkey)}&lud16=${lnAddress}`;

  return {
    nwcString,
    lnAddress,
    service,
  };
}

export async function createNostrProfile(
  info: {
    name: string;
    about?: string;
    picture?: string;
    lnAddress?: string;
  },
  privkey?: Uint8Array
) {
  privkey = privkey || generateSecretKey();

  // outbox relays
  const OUTBOX_RELAYS = [
    "wss://purplepag.es",
    "wss://user.kindpag.es",
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://relay.nos.social",
  ];

  // profile relays
  const PROFILE_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://relay.nos.social",
    "wss://nostr.mom",
  ];

  const content: any = {
    name: info.name,
  };
  if (info.about) content.about = info.about;
  if (info.picture) content.picture = info.picture;
  if (info.lnAddress) content.lud16 = info.lnAddress;

  const profileEvent = finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify(content),
      tags: [],
    },
    privkey
  );
  await Promise.allSettled(
    new SimplePool().publish(OUTBOX_RELAYS, profileEvent)
  );

  const relaysEvent = finalizeEvent(
    {
      kind: 10002,
      created_at: Math.floor(Date.now() / 1000),
      content: "",
      tags: PROFILE_RELAYS.map((r) => ["r", r]),
    },
    privkey
  );
  await Promise.allSettled(
    new SimplePool().publish(OUTBOX_RELAYS, relaysEvent)
  );

  return {
    privkey,
    pubkey: getPublicKey(privkey),
    npub: nip19.npubEncode(profileEvent.pubkey),
    relays: PROFILE_RELAYS,
  };
}
