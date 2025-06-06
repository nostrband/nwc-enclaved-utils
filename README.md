# nwc-enclaved-utils

Utilities to work with [nwc-enclaved](https://github.com/nostrband/nwc-enclaved/) Lightning Wallets.

## Create wallet

You can create a Lightning Wallet using our helper function `createWallet`:

```js
import { createWallet } from "nwc-enclaved-utils";

const { nwcString, lnAddress } = await createWallet();

// `nwcString` can be used with NWC sdk to use the wallet
console.log("nwcString", nwcString);
// `lnAddress` can be published in a nostr profile to receive zaps
console.log("lnAddress", lnAddress);
```

## Wallet usage

After you created a wallet, you will receive an `nwcString`. This connection string can be used with wallets
like [Alby Go](https://albygo.com/) or NWC SDK libraries like [Alby SDK](https://github.com/getAlby/js-sdk/blob/master/docs/nwc.md).
Learn more about NWC [here](https://github.com/nostr-protocol/nips/blob/master/47.md).

```js
import { createWallet } from "nwc-enclaved-utils";
import { nwc } from "@getalby/sdk";

const { nwcString } = await createWallet();

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

## Receiving Zaps

After you created a wallet you can publish a Nostr profile with the returned `lnAddress`
using our helper function `createNostrProfile`. This Nostr profile will then be able to receive
zaps into your new wallet.

```js
import { createWallet, createNostrProfile } from "nwc-enclaved-utils";
import { nwc } from "@getalby/sdk";

const { nwcString, lnAddress } = await createWallet();

// NOTE: use nwcString to access your wallet

// publish Nostr profile to receive Zaps
const { privkey, npub, relays } = await createNostrProfile({
  name: "NewUserName",
  lnAddress,
});

// You can now search this `npub` in some Nostr client
console.log("profile npub", npub);

// NOTE: use `privkey` to sign Nostr events of this new profile,
// use `relays` to publish the signed events.
```

You can also update an existing Nostr profile by setting the `lud16` profile field to your `lnAddress`.

## Vibe coding

Here is a sample prompt we used with Cursor + Claude-3.5 Sonnet to make a simple app that allows users to create lightning wallets:


> Let's create a web single page app on js so that users could create a lightning network wallet for themselves. We will use nwc-enclaved-utils library to create wallets. The app should have a title "Create a lightning wallet with one click". Then a button Create wallet, it should use nwc-enclaved-utils to create a wallet. After wallet is created it should display a readonly box under the button, named "NWC connection string" and display the nwcstring there, with a "copy to clipboard" button at the right. Next it should display a readonly input called "LN address" with lnAddress displayed there and a similar copy to clipboard button.  Read the documentation at https://github.com/nostrband/nwc-enclaved-utils first to understand how to use the library. Use minimalistic simple UI components and plain html/js if possible. You only have one shot at it, do not ask questions, try to finish everything in one pass and deliver a working product. 

## Wallet Service Discovery

Wallet services can be discovered using `discoverWalletServices` function, to learn more about safety and validation of services read [NECs](https://github.com/nostrband/necs)