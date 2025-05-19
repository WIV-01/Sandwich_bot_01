// config.js

// === Network-specific configurations ===
const SEPOLIA_CONFIG = {
  NETWORK: 'sepolia',
  ETH_ADDRESS: '0xA93ab4D0405fBAE445334566B147470AeF9A1528',
  CONTRACT_ADDRESS: '0x4243b11b2c5f8bC7053D6a1f812f36cCf5791C83',
  USDC_ADDRESS: '0x95831354ec5f22e185f24675e9b3486e99a8786f',
};

const MAINNET_CONFIG = {
  NETWORK: 'mainnet',
  ETH_ADDRESS: '0xA93ab4D0405fBAE445334566B147470AeF9A1528',
  CONTRACT_ADDRESS: '0xYourMainnetContractAddressHere',
  USDC_ADDRESS: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
};

// === General settings ===
const COMMON_CONFIG = {
  INITIAL_INVESTMENT_ETH: 0.01,                // ETH to invest initially
  MARTINGALE_FACTOR: 2,                        // How much to multiply after each loss
  PRICE_CHANGE_BUY: 0.25,                      // % drop before buying more ETH
  BALANCE_REFRESH_INTERVAL_MS: 5_000,          // How often to refresh balances (ms)
  ETH_PRICE_CACHE_DURATION_MS: 60_000,         // How often to update ETH price (ms)
};

// === Select active network here ===
// Change this to 'mainnet' when deploying live
const SELECTED_NETWORK = 'sepolia'; // or 'mainnet'

// === Combine network-specific and common configs ===
const ACTIVE_CONFIG = SELECTED_NETWORK === 'mainnet'
  ? MAINNET_CONFIG
  : SEPOLIA_CONFIG;

export const CONFIG = {
  ...ACTIVE_CONFIG,
  ...COMMON_CONFIG
};
