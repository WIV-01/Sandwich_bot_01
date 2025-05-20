//ℹ️ Imports
import { CONTRACT_ABI } from './abi.js'; // ✅ Contract ABI

//ℹ️ Global variables
let provider;
let signer;
let contract;
let balanceInterval = null;
let cachedETHPrice = null;
let lastPriceFetchTime = 0;
let dbl_Price_change = 0; // in percentages (%)
let bln_Sell = false; //Place a sell order
let dbl_delta_Price_Avg = null;
let dbl_delta_Avg_Entryprice = null;
let dbl_Disitance_betwee_Entryprice_Price = null;
let bln_Buy = false; //Place a buy order

//ℹ️ Constant variables
const timestamp = Date.now();  
const dbl_Martingale_factor = 2;
const dbl_Initial_investment = 0.01; // Initial investment in $
const dbl_minimum_Disitance_between_buy_orders = 0.01; // in percentages (%)

//ℹ️ Arrays 
const arr_PnL = []; 
const arr_buy_Trades = [];
const arr_sell_Trades = [];

//ℹ️ Metamask ETH address used
const ETH_ADDRESS = "0xA93ab4D0405fBAE445334566B147470AeF9A1528"; // ✅ ETH

//ℹ️ Mainnet
/*const CONTRACT_ADDRESS = "0x4243b11b2c5f8bC7053D6a1f812f36cCf5791C83"; // ✅ Your deployed contract
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // ✅ USDC */

//ℹ️ Testnet
const CONTRACT_ADDRESS = "0x4243b11b2c5f8bC7053D6a1f812f36cCf5791C83"; // ✅ Your deployed contract
const USDC_ADDRESS = "0x95831354ec5f22e185f24675e9b3486e99a8786f"; // ✅ Sepolia test USDC

//ℹ️ ABI
const usdcAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];
// ========================================================================================



// ========================================================================================
// === Window function ===
// ========================================================================================
window.addEventListener("DOMContentLoaded", async () => {
 
  // Set up UI button event listeners
  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("disconnectWalletBtn").addEventListener("click", disconnectWallet);
  document.getElementById("swapTokenBtn").addEventListener("click", swapTokenForETH);
  document.getElementById("swapEthBtn").addEventListener("click", swapETHForToken);
  document.getElementById("pauseBotBtn").addEventListener("click", pauseBot);
  document.getElementById("resumeBotBtn").addEventListener("click", resumeBot);

  toggleControls(false); // Initially disable all actions

  // 🔁 Auto-reconnect if wallet already authorized
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });

      if (accounts.length > 0) {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        const address = accounts[0];
        document.getElementById("walletAddress").innerText = "Connected: " + address;
        await updateBalances(address);

        // Start polling balances
        if (balanceInterval) clearInterval(balanceInterval);
        balanceInterval = setInterval(async () => {
          const currentAddress = await signer.getAddress();
          await updateBalances(currentAddress);
        }, 5000);

        toggleControls(true); // Enable action buttons
      }
    } catch (err) {
      console.error("13 - Auto-reconnect error:", err);
    }
  }
});
// ========================================================================================



// ========================================================================================
// === Functions ===
// ========================================================================================
function toggleControls(connected) {
  document.getElementById("connectWalletBtn").disabled = connected;
  document.getElementById("disconnectWalletBtn").disabled = !connected;
  document.getElementById("swapTokenBtn").disabled = !connected;
  document.getElementById("swapEthBtn").disabled = !connected;
  document.getElementById("pauseBotBtn").disabled = !connected;
  document.getElementById("resumeBotBtn").disabled = !connected; 
}

// === Handle tiny ETH values smartly
function formatETH(val) {
  if (val >= 1) return val.toFixed(4);
  if (val >= 0.01) return val.toFixed(6);
  if (val >= 0.000001) return val.toFixed(8);
  return val.toFixed(12); // show more precision for very small amounts
}

// === Get contract ETH balance
async function getContractETHBalance() {
  const balance = await provider.getBalance(CONTRACT_ADDRESS);
  const formatted = parseFloat(ethers.formatEther(balance)).toFixed(6);
  return formatted;
}
// ========================================================================================



// ========================================================================================
// === Get ETH price in USD ===
// ========================================================================================
async function getETHPriceUSD() {
  const now = Date.now();

  //=== If fetched in last 60 seconds, return cached value v===
  if (cachedETHPrice !== null && (now - lastPriceFetchTime) < 60000) {
    return cachedETHPrice;
  }

  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await response.json();
    const price = data?.ethereum?.usd;

    if (price) {
      cachedETHPrice = price;
      lastPriceFetchTime = now;
    }
    return price;
  } catch (err) {
    console.error("Error fetching ETH price:", err);
    return cachedETHPrice; // Return old value if available
  }
}
// ========================================================================================



// ========================================================================================
// === Execute trades ===
// ========================================================================================
function dh_trades(price) {
  const _colname_Time = "Time";
  const _colname_Entry_price = "Entry price";
  const _colname_Change_price = "Change(%)";
  const _colname_Trade_price = "Trade Price";
  const _colname_f = "f";
  const _colname_f2 = "f2";
  const _colname_Investment_ETH = "Investment (ETH)";
  const _colname_Investment_USDC = "Investment (USDC)"; 
  const _colname_PnL = "PnL";
  
  try {
    // === Validate price ===
    if (typeof price !== 'number' || isNaN(price)) {
      console.error("15 - Invalid price passed to function dh_trades(price):", price);
      return;
    }

    // === Check if last price is the same as current price ===
    const dbl_Entryprice_temp = arr_buy_Trades.length > 0 ? Number(arr_buy_Trades[0][_colname_Trade_price]) : null;
    const dbl_Entryprice = dbl_Entryprice_temp !== null ? dbl_Entryprice_temp.toFixed(2) : price.toFixed(2);

    // === Price change: Entry price vs current price (%) ===
    if (arr_buy_Trades.length > 0) {
      const lastTrade = arr_buy_Trades[arr_buy_Trades.length - 1];
      
      if (Number(lastTrade[_colname_Trade_price]) === price) {
        dbl_Price_change = 0; //No price change
      } else {
        dbl_Price_change = getPercentageChange(dbl_Entryprice_temp, price); //Price changed
      }     

      if (price < Number(lastTrade[_colname_Trade_price])) {
        bln_Buy = true;
      }
      
    }

    //=== Place a buy order ===
    if (
      arr_buy_Trades.length === 0 ||
      (
        arr_buy_Trades.length > 0 &&
        //price <= Number(lastTrade[_colname_Trade_price]) &&
        dbl_Price_change <= -0.01
      )
    ) {
      bln_Buy = true;
    }

    const f = Math.abs(Number(dbl_Price_change / dbl_minimum_Disitance_between_buy_orders).toFixed(0));
    const f2 = Math.pow(2, f);
    const dbl_Investment_ETH = (Math.pow(dbl_Martingale_factor, arr_buy_Trades.length) * dbl_Initial_investment * f2)/price;
    const dbl_Investment_USDC = Math.pow(dbl_Martingale_factor, arr_buy_Trades.length) * dbl_Initial_investment * f2;
    
     // === Add trade to table when price change occurs(current price < previous price)
    if (bln_Buy === true) {
      arr_buy_Trades.push({
        [_colname_Time]: new Date().toLocaleString(),
        [_colname_Entry_price]: dbl_Entryprice,
        [_colname_Trade_price]: price.toFixed(2),
        [_colname_Change_price]: dbl_Price_change,
        [_colname_f]: f,
        [_colname_f2]: Number(f2.toFixed(0)),
        [_colname_Investment_ETH]: Number(dbl_Investment_ETH.toFixed(8)),
        [_colname_Investment_USDC]: Number(dbl_Investment_USDC.toFixed(8))
      });

      arr_PnL.push({[_colname_PnL]: -Number(dbl_Investment_USDC.toFixed(8))});     
    }

    // === PnL
    const dbl_PnL = arr_PnL.reduce((sum, _PnL) => sum + Number(_PnL[_colname_PnL] || 0), 0); 

    console.log("🛒 Open position(s)");
    console.table(arr_buy_Trades);
    console.log("");
    console.log("💵 PnL Summary");
    console.table(arr_PnL);
    console.log("");
    console.log(`💰 PnL (USD): ${dbl_PnL}`); 
    
  } catch (err) {
    console.error("14 - Trade information error:", err);
  }
}
// ========================================================================================



// ========================================================================================
//  === Price change === 
// ========================================================================================
function getPercentageChange(oldPrice, newPrice) {
  if (oldPrice === 0) return 0; // Avoid division by zero
  const dbl_Price_change_temp = ((newPrice - oldPrice) / oldPrice) * 100;
  return dbl_Price_change_temp.toFixed(8); // Limit to 8 decimal places
}
// ========================================================================================



// ========================================================================================
// === Update wallet balances === 
// ========================================================================================
async function updateBalances(address) {
  try {
    const ethBalance = await provider.getBalance(address);   
    const ethFormatted = ethers.formatEther(ethBalance);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
    const usdcBalance = await usdcContract.balanceOf(address);
    const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
    const contractEthBalance = await getContractETHBalance(); 
    
    // 💰 Fetch and log ETH price
    const ethPriceUSD = await getETHPriceUSD();
    const usdValue = ethPriceUSD ? (parseFloat(ethFormatted) * ethPriceUSD).toFixed(2) : "N/A";
    
    console.clear();
    console.group("📊 Trade Summary");
    console.log(`
    📈 ETH Price (USD): ${ethPriceUSD}
    `);
    console.log(dh_trades(ethPriceUSD));
    console.groupEnd();
    
    document.getElementById("ethBalance").innerText = `ETH: ${parseFloat(ethFormatted).toFixed(4)} ETH`;
    document.getElementById("usdcBalance").innerText = `USDC: ${parseFloat(usdValue).toFixed(2)} USDC`;
    document.getElementById("contract_ethBalance").innerText = `ETH: ${parseFloat(contractEthBalance).toFixed(4)} ETH`;
    document.getElementById("contract_usdcBalance").innerText = `USDC: ${parseFloat(usdcFormatted).toFixed(2)} USDC`;
    
  } catch (err) {

      //Console message
      console.error("2 - Balance fetch error:", err);
      document.getElementById("ethBalance").innerText = "ETH: Metamask Error";
      document.getElementById("usdcBalance").innerText = "USDC: Metamask Error";
  }
}
// ========================================================================================



// ========================================================================================
// === Connect/Disconnect Metamask wallet === 
// ========================================================================================
async function connectWallet() {
  if (!window.ethereum) {
    alert("Please install MetaMask.");
    return;
  }
  try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const address = await signer.getAddress();
    
      document.getElementById("walletAddress").innerText = "Connected: " + address;
      await updateBalances(address); // 👈 Initial fetch

      if (balanceInterval) {
        clearInterval(balanceInterval);
      }
      
      // ✅ Refresh Metamask wallet balances every 30 seconds
      // Save interval ID so you can clear it later if needed
      balanceInterval = setInterval(async () => {
        const currentAddress = await signer.getAddress();
        await updateBalances(currentAddress);
      }, 30000);
    
      // Enable controls
      toggleControls(true);

  } catch (err) {

    //Console message
    console.error("3 - Wallet connection error:", err);
    
    alert(err?.data?.message || err?.message || "Failed to connect wallet.");
  }
}

function disconnectWallet() {
  if (balanceInterval) {
    clearInterval(balanceInterval);
    balanceInterval = null;
  }

  provider = null;
  signer = null;
  contract = null;

  document.getElementById("walletAddress").innerText = "Wallet disconnected";
  document.getElementById("ethBalance").innerText = "ETH Balance:";
  document.getElementById("usdcBalance").innerText = "USDC Balance:";

  // Disable controls
  toggleControls(false);
}

function showTxStatus(message, isError = false) {
  const statusDiv = document.getElementById("txStatus");
  
  statusDiv.style.color = isError ? 'red' : '#444';
  statusDiv.innerHTML = message;
}

async function swapTokenForETH() {
  const swapBtn = document.getElementById("swapTokenBtn");
  
  swapBtn.disabled = true; // Disable button immediately to prevent double submissions
  showTxStatus(''); // Clear status on start
  
  const amount = document.getElementById("amountIn").value.trim();
  
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    alert("Please enter a valid USDC amount greater than 0.");
    swapBtn.disabled = false;
    return;
  }
 
  const slippageInput = document.getElementById("slippageIn").value.trim();
  const slippage = Number(slippageInput);
  
  if (isNaN(slippage) || slippage < 0 || slippage > 50) {
    alert("Slippage must be a number between 0 and 50.");
    swapBtn.disabled = false;
    return;
  }

  try {
    showTxStatus("Approving and sending transaction...");
    
    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
    const amountIn = ethers.parseUnits(amount, 6); // ✅ USDC has 6 decimals
    const ownerAddress = await signer.getAddress();
    const allowance = await usdcContract.allowance(ownerAddress, CONTRACT_ADDRESS); // Check current allowance

    // Approve contract if allowance insufficient
    if (allowance.lt(amountIn)) {
      const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, amountIn);
      
      showTxStatus(`Approving USDC... <a href="https://etherscan.io/tx/${approveTx.hash}" target="_blank" rel="noopener noreferrer">View Tx</a>`);
      await approveTx.wait();

      //Console message
      console.log("5 - USDC approved for contract.");
    }

    // Call swap function on your contract
    const tx = await contract.swapTokenForETHWithSlippage(USDC_ADDRESS, amountIn, slippage);

    showTxStatus(`Swapping USDC for ETH... <a href="https://etherscan.io/tx/${tx.hash}" target="_blank" rel="noopener noreferrer">View Tx</a>`);
    
    // Immediately update the status with the tx hash & link
    document.getElementById("txStatus").innerHTML = `Transaction sent! <a href="https://etherscan.io/tx/${tx.hash}" target="_blank" rel="noopener noreferrer">View on Etherscan</a>`;
    await tx.wait();
    showTxStatus("Swap completed successfully! 🎉");
    
    // Update UI after success
    //document.getElementById("txStatus").innerHTML = "Swap completed successfully! 🎉";
    alert("USDC → ETH swap completed!");
    await updateBalances(await signer.getAddress());
  } catch (err) {
      if (err.code === 4001) {
        alert("Transaction rejected by user.");
        showTxStatus("Transaction rejected by user.", true);
      } else {

        //Console message
        console.error("6 - swapTokenForETH error:", err);
        
        alert("Swap failed. See console for details.");
        showTxStatus("Swap failed. See console for details.", true);
      }
    
      //Console message
      console.error("7 - Error:", err);
  } finally {
    swapBtn.disabled = false; // Re-enable button
  }
}
// ========================================================================================



// ========================================================================================
// ========================================================================================
async function swapETHForToken() {
  const swapEthBtn = document.getElementById("swapEthBtn");
  
  swapEthBtn.disabled = true; // Disable button immediately to prevent double submissions
  showTxStatus(''); // Clear status on start
  
  const ethAmount = document.getElementById("ethAmount").value.trim(); 
  
  if (!ethAmount || isNaN(ethAmount) || Number(ethAmount) <= 0) {
    alert("Please enter a valid ETH amount greater than 0.");
    swapEthBtn.disabled = false;
    return;
  }

  const slippageInput = document.getElementById("slippageOut").value.trim();
  const slippage = Number(slippageInput);
  
  if (isNaN(slippage) || slippage < 0 || slippage > 50) {
    alert("Slippage must be a number between 0 and 50.");
    swapEthBtn.disabled = false;
    return;
  }

  try {
    const value = ethers.parseEther(ethAmount); // ✅ ETH has 18 decimals
    
    showTxStatus(`Swapping ETH for USDC...`);
    
    const tx = await contract.swapETHForTokenWithSlippage(USDC_ADDRESS, slippage, { value });

    showTxStatus(`Transaction sent! <a href="https://etherscan.io/tx/${tx.hash}" target="_blank" rel="noopener noreferrer">View on Etherscan</a>`);
    await tx.wait();
    alert("ETH → USDC swap completed!");
    showTxStatus("Swap completed successfully! 🎉");
    await updateBalances(await signer.getAddress());
    
  } catch (err) {
      if (err.code === 4001) {
        alert("Transaction rejected by user.");
        showTxStatus("Transaction rejected by user.", true);
      } else {
        //Console message
        console.error("8 - SwapETHForToken error:", err);
        
        alert("Swap failed. See console for details.");
        showTxStatus("Swap failed. See console for details.", true);
      }
      //Console message
      console.error("9 - Error:", err);
  } finally {
    swapEthBtn.disabled = false; // Re-enable button
  }
}
// ========================================================================================



// ========================================================================================
// === Pause/Stop bot
// ========================================================================================
async function pauseBot() {
  const pauseBtn = document.getElementById("pauseBotBtn");
  
  pauseBtn.disabled = true;
  
  try {
    const tx = await contract.pauseBot();
    
    await tx.wait();
    alert("Bot paused.");
    await updateBalances(await signer.getAddress()); // ✅
  } catch (err) {
    //Console message
    console.error("10 - PauseBot error:", err);
    alert("Pause failed. Are you the contract owner?");
  } finally {
    pauseBtn.disabled = false;
  }
}

async function resumeBot() {
  const resumeBtn = document.getElementById("resumeBotBtn");
  
  resumeBtn.disabled = true;
  
  try {
    const tx = await contract.resumeBot();
    
    await tx.wait();
    alert("Bot resumed.");
    await updateBalances(await signer.getAddress()); // ✅
  } catch (err) {
    //Console message
    console.error("11 - ResumeBot error:", err);
    alert("Resume failed. Are you the contract owner?");
  } finally {
    resumeBtn.disabled = false;
  }
}
// ========================================================================================


// ========================================================================================
// === Others ===
// ========================================================================================
// Optional: Catch uncaught errors globally
window.addEventListener("error", (e) => {
  //Console message
  console.error("12 - Global error:", e);
});
// ========================================================================================



/*
    // === Calculate average price from arr_buy_Trades, or use current price if empty ===
    const tempSum = arr_buy_Trades.reduce((sum, trade) => sum + Number(trade["Price"]), 0) + price;
    const avg = tempSum / (arr_buy_Trades.length + 1);

    // === Diff. between Entryprice and AVG price ===
    if (firstPrice !== null && !isNaN(avg)) {
      dbl_delta_Avg_Entryprice = getPercentageChange(firstPrice_temp, avg);
    } else {
      dbl_delta_Avg_Entryprice = 0;
    }

    //Diff. between Price and AVG price
    if (price !== null && !isNaN(avg)) {
      dbl_delta_Price_Avg = getPercentageChange(price, avg);
    } else {
      dbl_delta_Price_Avg = 0;
    }

    //Diff. between Entryprice and Price
    if (price !== null && firstPrice_temp !== null) {
      dbl_Disitance_betwee_Entryprice_Price = getPercentageChange(price, firstPrice_temp);
    } else {
      dbl_Disitance_betwee_Entryprice_Price = 0;
    }

    "f2": Math.pow(2, Number(f.toFixed(0))),
    "Invest": Math.pow(dbl_Martingale_factor, arr_buy_Trades.length) * dbl_Initial_investment
    
        "Average": avg.toFixed(2),
        "Price vs AVG": dbl_delta_Price_Avg,
        "Price vs Entry price": dbl_delta_Price_Entryprice,
    
*/
