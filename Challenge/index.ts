// Hello Scroll!
// leyzerok.eth
// Scroll Level Up Challenge

import { config as dotenv } from "dotenv";
import {
  createWalletClient,
  http,
  getContract,
  erc20Abi,
  parseUnits,
  maxUint256,
  publicActions,
  concat,
  numberToHex,
  size,
} from "viem";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { scroll } from "viem/chains";
import { wethAbi } from "./abi/weth-abi";

/* For the 0x Challenge on Scroll, implement the following

1. Display the percentage breakdown of liquidity sources
2. Monetize your app with affiliate fees and surplus collection
3. Display buy/sell tax for tokens with tax
4. Display all sources of liquidity on Scroll

*/

const qs = require("qs");

// load env vars
dotenv();
const { PRIVATE_KEY, ZERO_EX_API_KEY, ALCHEMY_HTTP_TRANSPORT_URL } =
  process.env;

// validate requirements
if (!PRIVATE_KEY) throw new Error("missing PRIVATE_KEY.");
if (!ZERO_EX_API_KEY) throw new Error("missing ZERO_EX_API_KEY.");
if (!ALCHEMY_HTTP_TRANSPORT_URL)
  throw new Error("missing ALCHEMY_HTTP_TRANSPORT_URL.");

// fetch headers
const headers = new Headers({
  "Content-Type": "application/json",
  "0x-api-key": ZERO_EX_API_KEY,
  "0x-version": "v2",
});

// setup wallet client
const client = createWalletClient({
  account: privateKeyToAccount(`0x${PRIVATE_KEY}` as `0x${string}`),
  chain: scroll,
  transport: http(ALCHEMY_HTTP_TRANSPORT_URL),
}).extend(publicActions); // extend wallet client with publicActions for public client

const [address] = await client.getAddresses();

// set up contracts
const weth = getContract({
  address: "0x5300000000000000000000000000000000000004",
  abi: wethAbi,
  client,
});
const wsteth = getContract({
  address: "0xf610A9dfB7C89644979b4A0f27063E9e7d7Cda32",
  abi: erc20Abi,
  client,
});

const main = async () => {
  const decimals = (await weth.read.decimals()) as number;
  const sellAmount = parseUnits("0.1", decimals);
  const priceParams = new URLSearchParams({
    chainId: client.chain.id.toString(),
    sellToken: weth.address,
    buyToken: wsteth.address,
    sellAmount: sellAmount.toString(),
    taker: client.account.address,
  });
  const priceResponse = await fetch(
    "https://api.0x.org/swap/permit2/price?" + priceParams.toString(),
    {
      headers: headers,
    }
  );
  const price = await priceResponse.json();
  const quoteParams = new URLSearchParams();
  for (const [key, value] of priceParams.entries()) {
    quoteParams.append(key, value);
  }

  const quoteResponse = await fetch(
    "https://api.0x.org/swap/permit2/quote?" + quoteParams.toString(),
    {
      headers,
    }
  );
  const quote = await quoteResponse.json();

  const sourcesParams = new URLSearchParams({
    chainId: client.chain.id.toString(),
  });
  const sourcesResponse = await fetch(
    "https://api.0x.org/sources?" + sourcesParams.toString(),
    {
      headers,
    }
  );
  const sources = (await sourcesResponse.json()).sources;

  // 1
  const fills = quote.route.fills;
  console.log(`${fills.length} Sources`);
  for (let i = 0; i < fills.length; i++) {
    console.log(`${fills[i].source}: ${fills[i].proportionBps / 100}%`);
  }

  // 2
  const affiliateFeeParams = new URLSearchParams({
    chainId: client.chain.id.toString(),
    sellToken: weth.address,
    buyToken: wsteth.address,
    sellAmount: sellAmount.toString(),
    taker: client.account.address,
    swapFeeRecipient: client.account.address,
    swapFeeBps: "100",
    swapFeeToken: wsteth.address,
  });
  const affiliateFeeResponse = await fetch(
    "https://api.0x.org/swap/permit2/quote?" + affiliateFeeParams.toString(),
    {
      headers,
    }
  );
  const affiliateFee = await affiliateFeeResponse.json();
  console.log("fee", affiliateFee.fees);

  // 3
  console.log(
    `Buy token Buy tax:", ${price.tokenMetadata.buyToken.buyTaxBps / 1000}%`
  );
  console.log(
    `Buy token Sell tax:", ${price.tokenMetadata.buyToken.sellTaxBps / 1000}%`
  );
  console.log(
    `Sell token Buy tax:", ${price.tokenMetadata.sellToken.buyTaxBps / 1000}%`
  );
  console.log(
    `Sell token Sell tax:", ${price.tokenMetadata.sellToken.sellTaxBps / 1000}%`
  );

  // 4
  console.log("Liquidity sources for Scroll chain:");
  for (let i = 0; i < sources.length; i++) {
    console.log("\t", sources[i]);
  }
};
main();
