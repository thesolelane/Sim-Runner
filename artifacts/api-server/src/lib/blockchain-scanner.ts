import { logger } from "./logger";

export type ChainId = "solana" | "ethereum" | "base" | "arbitrum" | "monad";

export interface BlockchainAccountInfo {
  chain: ChainId;
  chainName: string;
  address: string;
  accountType: "contract" | "wallet" | "unknown";
  balance: string | null;
  balanceRaw: string | null;
  isActive: boolean;
  dataSize: number | null;
  executable: boolean | null;
  owner: string | null;
  explorerUrl: string;
  quantumRoadmap: {
    status: string;
    details: string;
    reference: string | null;
  };
  scannedAt: string;
  error: string | null;
}

const CHAIN_CONFIGS: Record<ChainId, {
  name: string;
  rpcUrl: string;
  type: "solana" | "evm";
  explorerBase: string;
  nativeSymbol: string;
  nativeDecimals: number;
  quantumRoadmap: { status: string; details: string; reference: string | null };
}> = {
  solana: {
    name: "Solana",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    type: "solana",
    explorerBase: "https://solscan.io/account",
    nativeSymbol: "SOL",
    nativeDecimals: 9,
    quantumRoadmap: {
      status: "Research phase",
      details: "The Solana Foundation has acknowledged quantum risk to its Ed25519 signature scheme. A cryptography working group is researching lattice-based alternatives, but no official migration timeline has been published as of 2025.",
      reference: "https://solana.com/news",
    },
  },
  ethereum: {
    name: "Ethereum",
    rpcUrl: "https://ethereum.publicnode.com",
    type: "evm",
    explorerBase: "https://etherscan.io/address",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    quantumRoadmap: {
      status: "Long-term roadmap item",
      details: "The Ethereum roadmap includes account abstraction (EIP-4337) as a step toward quantum-resistant wallets. Vitalik Buterin has proposed hash-based signatures as an emergency fallback. No concrete deployment timeline for PQC key exchange or signatures exists as of 2025.",
      reference: "https://ethereum.org/en/roadmap/",
    },
  },
  base: {
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    type: "evm",
    explorerBase: "https://basescan.org/address",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    quantumRoadmap: {
      status: "Inherits Ethereum roadmap",
      details: "Base is an Ethereum Layer 2 built by Coinbase. It inherits Ethereum's security model and will adopt any PQC improvements rolled out at the L1 level. No independent PQC roadmap has been published.",
      reference: "https://docs.base.org/",
    },
  },
  arbitrum: {
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    type: "evm",
    explorerBase: "https://arbiscan.io/address",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    quantumRoadmap: {
      status: "Inherits Ethereum roadmap",
      details: "Arbitrum is an Ethereum Layer 2 operated by Offchain Labs. Its security depends on Ethereum L1 and will benefit from Ethereum's PQC upgrades. No independent PQC roadmap has been published.",
      reference: "https://arbitrum.io/",
    },
  },
  monad: {
    name: "Monad Testnet",
    rpcUrl: "https://testnet-rpc.monad.xyz",
    type: "evm",
    explorerBase: "https://testnet.monadexplorer.com/address",
    nativeSymbol: "MON",
    nativeDecimals: 18,
    quantumRoadmap: {
      status: "No published roadmap",
      details: "Monad is an EVM-compatible L1 currently on testnet. No post-quantum cryptography roadmap has been published as of 2025. Being EVM-compatible, any ECDSA vulnerabilities present on Ethereum also apply here.",
      reference: null,
    },
  },
};

async function jsonRpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}: ${response.statusText}`);
  }
  const json = await response.json() as { result?: unknown; error?: { message?: string } };
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message ?? JSON.stringify(json.error)}`);
  }
  return json.result;
}

function formatLamports(lamports: number): string {
  return (lamports / 1e9).toFixed(4) + " SOL";
}

function formatWei(weiHex: string, decimals: number, symbol: string): string {
  try {
    const wei = BigInt(weiHex);
    const divisor = BigInt(10 ** decimals);
    const whole = wei / divisor;
    const frac = wei % divisor;
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
    return `${whole}.${fracStr} ${symbol}`;
  } catch {
    return `${weiHex} (raw)`;
  }
}

async function scanSolana(address: string, config: typeof CHAIN_CONFIGS.solana): Promise<BlockchainAccountInfo> {
  const result = await jsonRpc(config.rpcUrl, "getAccountInfo", [
    address,
    { encoding: "base64", commitment: "confirmed" },
  ]) as { value: { lamports: number; owner: string; executable: boolean; data: unknown[] } | null } | null;

  const value = result?.value ?? null;

  if (!value) {
    return {
      chain: "solana",
      chainName: config.name,
      address,
      accountType: "unknown",
      balance: "0 SOL",
      balanceRaw: "0",
      isActive: false,
      dataSize: null,
      executable: null,
      owner: null,
      explorerUrl: `${config.explorerBase}/${address}`,
      quantumRoadmap: config.quantumRoadmap,
      scannedAt: new Date().toISOString(),
      error: null,
    };
  }

  const dataBytes = Array.isArray(value.data) && typeof value.data[0] === "string"
    ? Buffer.from(value.data[0] as string, "base64").length
    : 0;

  const accountType: BlockchainAccountInfo["accountType"] = value.executable
    ? "contract"
    : value.owner !== "11111111111111111111111111111111"
    ? "contract"
    : "wallet";

  return {
    chain: "solana",
    chainName: config.name,
    address,
    accountType,
    balance: formatLamports(value.lamports),
    balanceRaw: String(value.lamports),
    isActive: value.lamports > 0 || dataBytes > 0,
    dataSize: dataBytes > 0 ? dataBytes : null,
    executable: value.executable,
    owner: value.owner,
    explorerUrl: `${config.explorerBase}/${address}`,
    quantumRoadmap: config.quantumRoadmap,
    scannedAt: new Date().toISOString(),
    error: null,
  };
}

async function scanEvm(
  address: string,
  chainId: ChainId,
  config: (typeof CHAIN_CONFIGS)[keyof typeof CHAIN_CONFIGS],
): Promise<BlockchainAccountInfo> {
  const [balanceHex, codeHex] = await Promise.all([
    jsonRpc(config.rpcUrl, "eth_getBalance", [address, "latest"]) as Promise<string>,
    jsonRpc(config.rpcUrl, "eth_getCode", [address, "latest"]) as Promise<string>,
  ]);

  const hasCode = typeof codeHex === "string" && codeHex !== "0x" && codeHex.length > 2;
  const codeSize = hasCode ? Math.floor((codeHex.length - 2) / 2) : 0;
  const accountType: BlockchainAccountInfo["accountType"] = hasCode ? "contract" : "wallet";
  const isActive = hasCode || (typeof balanceHex === "string" && balanceHex !== "0x0" && balanceHex !== "0x");

  return {
    chain: chainId,
    chainName: config.name,
    address,
    accountType,
    balance: typeof balanceHex === "string"
      ? formatWei(balanceHex, config.nativeDecimals, config.nativeSymbol)
      : null,
    balanceRaw: balanceHex ?? null,
    isActive,
    dataSize: hasCode ? codeSize : null,
    executable: hasCode ? true : null,
    owner: null,
    explorerUrl: `${config.explorerBase}/${address}`,
    quantumRoadmap: config.quantumRoadmap,
    scannedAt: new Date().toISOString(),
    error: null,
  };
}

export async function scanBlockchainAddress(
  chainId: ChainId,
  address: string,
): Promise<BlockchainAccountInfo> {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  try {
    if (config.type === "solana") {
      return await scanSolana(address, config as typeof CHAIN_CONFIGS.solana);
    }
    return await scanEvm(address, chainId, config);
  } catch (err) {
    logger.warn({ err, chainId, address }, "Blockchain scan failed");
    return {
      chain: chainId,
      chainName: config.name,
      address,
      accountType: "unknown",
      balance: null,
      balanceRaw: null,
      isActive: false,
      dataSize: null,
      executable: null,
      owner: null,
      explorerUrl: `${config.explorerBase}/${address}`,
      quantumRoadmap: config.quantumRoadmap,
      scannedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const SUPPORTED_CHAINS: { id: ChainId; name: string }[] = [
  { id: "solana", name: "Solana" },
  { id: "ethereum", name: "Ethereum" },
  { id: "base", name: "Base" },
  { id: "arbitrum", name: "Arbitrum One" },
  { id: "monad", name: "Monad Testnet" },
];
