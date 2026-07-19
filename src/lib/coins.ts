/**
 * Curated list of common cryptocurrencies for the asset picker. `id` is the
 * CoinGecko id used to fetch live USD prices (`/simple/price?ids=<id>`); `symbol`
 * and `name` are for display/search. Kept intentionally to the popular set — the
 * price API supports thousands, but this covers almost everyone without a typo'd
 * id (a wrong id = no price).
 */
export type Coin = { id: string; symbol: string; name: string };

export const COINS: Coin[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "tether", symbol: "USDT", name: "Tether" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "tron", symbol: "TRX", name: "TRON" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  { id: "bitcoin-cash", symbol: "BCH", name: "Bitcoin Cash" },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol" },
  { id: "matic-network", symbol: "MATIC", name: "Polygon" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap" },
  { id: "internet-computer", symbol: "ICP", name: "Internet Computer" },
  { id: "ethereum-classic", symbol: "ETC", name: "Ethereum Classic" },
  { id: "stellar", symbol: "XLM", name: "Stellar" },
  { id: "cosmos", symbol: "ATOM", name: "Cosmos" },
  { id: "monero", symbol: "XMR", name: "Monero" },
  { id: "filecoin", symbol: "FIL", name: "Filecoin" },
  { id: "aptos", symbol: "APT", name: "Aptos" },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum" },
  { id: "optimism", symbol: "OP", name: "Optimism" },
  { id: "vechain", symbol: "VET", name: "VeChain" },
  { id: "maker", symbol: "MKR", name: "Maker" },
  { id: "render-token", symbol: "RNDR", name: "Render" },
  { id: "injective-protocol", symbol: "INJ", name: "Injective" },
  { id: "the-graph", symbol: "GRT", name: "The Graph" },
  { id: "algorand", symbol: "ALGO", name: "Algorand" },
  { id: "hedera-hashgraph", symbol: "HBAR", name: "Hedera" },
  { id: "sui", symbol: "SUI", name: "Sui" },
  { id: "pepe", symbol: "PEPE", name: "Pepe" },
  { id: "aave", symbol: "AAVE", name: "Aave" },
  { id: "tezos", symbol: "XTZ", name: "Tezos" },
];

const byId = new Map(COINS.map((c) => [c.id, c]));

/** Look up a coin by its CoinGecko id (the value stored in `asset.symbol`). */
export function coinById(id: string | null | undefined): Coin | undefined {
  return id ? byId.get(id) : undefined;
}

/** Short display ticker for a coin id, falling back to the id itself. */
export function coinTicker(id: string | null | undefined): string {
  return coinById(id)?.symbol ?? (id ?? "").toUpperCase();
}
