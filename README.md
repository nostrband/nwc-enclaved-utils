# nwc-enclaved-utils

Utilities to help work with [nwc-enclaved](https://github.com/nostrband/nwc-enclaved/) Lightning Wallets.

## Discover wallet services

Here is how you discover NWC wallet services:

```js
  import { discoverWalletServices } from "nwc-enclaved-utils";
  const services = await discoverWalletServices();
  console.log("services", services);
```

Might print results like:

```js
services [
  {
    pubkey: '67122fa1b502e0ef3467fc8248af81f7291a0299ddebfcfed81bbb0c745f005c', // NWC servicePubkey
    maxSendable: 100000000, // max payment size in millisats
    minSendable: 1000, // min payment size in millisats
    maxBalance: 100000000, // max balance in millisats
    event: {
      content: '',
      created_at: 1745487373,
      id: '8415ee88722f5ffde4b3fdd4d6ed9d1a31e1457c73d7e5fc716aa0eb839c2e58',
      kind: 13196,
      pubkey: '67122fa1b502e0ef3467fc8248af81f7291a0299ddebfcfed81bbb0c745f005c',
      sig: '39488a92d8de7ff3b7335d5a91252948ced846ab044fbbad1aab64948bc9581876085f2fdaac68fe5cc52688bbaf5c75c4d77d6326774a4462648479717166be',
      tags: [Array],
    },
    relays: [ 'wss://relay.primal.net/' ] // NWC relay
  }
```

## Wallet usage

After you discover some wallet services you can use them.

Create [NWC](https://github.com/nostr-protocol/nips/blob/master/47.md) connection string to use with your NWC client:

```js
import { discoverWalletServices } from "nwc-enclaved-utils";
import { generateSecretKey } from "nostr-tools";

// discover some wallet services
const services = await discoverWalletServices();
if (!services.length) throw new Error("No wallet services");

// take first service for tests
const service = services[0];

// generate client private key, must be stored in localStorage or
// shown to user to make a backup
const clientPrivkey = generateSecretKey();

// NWC connection string
const nwcString = `nostr+walletconnect://${service.pubkey}?relay=${service.relays[0]}&secret=${bytesToHex(clientPrivkey)}`; 
console.log("nwcString", nwcString);

```

This NWC string can be used with wallets like [Alby Go](https://albygo.com/) or NWC SDK libraries like [Alby SDK](https://github.com/getAlby/js-sdk/blob/master/docs/nwc.md):

```js
import { nwc } from "@getalby/sdk";

const nwcString = "..."; // see example above 

const nwcClient = new nwc.NWCClient({
  nostrWalletConnectUrl: nwcString,
});

// get balance (returns 0 for new wallet)
const balance = await nwcClient.getBalance();
console.log("balance", balance);

// create invoice to topup the wallet,
// NOTE: amount is in millisats
const invoince = await nwcClient.makeInvoice({ amount: 10000 });
console.log("invoice", invoince);

```

## Lighting Network Address and Nostr Zaps

To create an LN address with zaps support you might use a service like [zap-land](https://github.com/nostrband/zap-land). It's 
a very simple service that translates a properly formatted LN address into a call to your `nwc-enclaved` wallet:

```js
import { nip19, getPublicKey } from "nostr-tools";

// discover a wallet service as above
// generate client private key as above

// your wallet service public key
const walletServicePubkey = service.pubkey;

// client public key
const clientPublicKey = getPublicKey(clientPrivkey);

// wallet service npub
const walletServiceNpub = nip19.npubEncode(walletServicePubkey);

// client npub
const clientNpub = nip19.npubEncode(clientPublicKey);

// LN address
const lnAddress = `${clientNpub}@${walletServiceNpub}.zap.land`;
console.log("lnAddress", lnAddress);

```

Now you can publish a Nostr profile with this zap address and receive zaps:

```js

import { generateSecretKey, finalizeEvent, SimplePool } from "nostr-tools";

// your LN address from example above
const lnAddress = "...";

// nostr key
const privkey = generateSecretKey();

// outbox relays
const relays = [
  "wss://purplepag.es",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://relay.nos.social",
];

// profile kind:0
const profileEvent = finalizeEvent(
  {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify({
      name: "test",
      lud16: lnAddress,
    }),
    tags: [],
  },
  privkey
);
await Promise.allSettled(new SimplePool().publish(relays, profileEvent));

// relay list kind:10002
const relaysEvent = finalizeEvent(
  {
    kind: 10002,
    created_at: Math.floor(Date.now() / 1000),
    content: "",
    tags: relays.map((r) => ["r", r]),
  },
  privkey
);
await Promise.allSettled(new SimplePool().publish(relays, relaysEvent));

// open this npub profile in some Nostr client
console.log("profile npub", nip19.npubEncode(profileEvent.pubkey));

```