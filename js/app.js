let provider;
let signer;
let contract;
let balanceInterval = null;

const CONTRACT_ADDRESS = "0x9ddd5962f9441a0400be0ab95777381bbfd4ec59"; // ✅ Your deployed contract
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // ✅ USDC Mainnet
//const CONTRACT_ABI = window.CONTRACT_ABI; // ✅ Contract ABI
const usdcAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

/*window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("disconnectWalletBtn").addEventListener("click", disconnectWallet);
  document.getElementById("swapTokenBtn").addEventListener("click", swapTokenForETH);
  document.getElementById("swapEthBtn").addEventListener("click", swapETHForToken);
  document.getElementById("pauseBotBtn").addEventListener("click", pauseBot);
  document.getElementById("resumeBotBtn").addEventListener("click", resumeBot);
  
  toggleControls(false);
});*/

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

function toggleControls(connected) {
  document.getElementById("connectWalletBtn").disabled = connected;
  document.getElementById("disconnectWalletBtn").disabled = !connected;
  document.getElementById("swapTokenBtn").disabled = !connected;
  document.getElementById("swapEthBtn").disabled = !connected;
  document.getElementById("pauseBotBtn").disabled = !connected;
  document.getElementById("resumeBotBtn").disabled = !connected; 
}

async function getETHPriceUSD() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await response.json();
    const price = data?.ethereum?.usd;

    return price;
  } catch (err) {
    
    return null;
  }
}

async function updateBalances(address) {
  try {
    const ethBalance = await provider.getBalance(address);

    //Console message
    //console.log("1a - Ethers object is:", ethers);
    //console.log("1b - Ethers.formatEther is:", ethers.formatEther);
    
    const ethFormatted = ethers.formatEther(ethBalance);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
    const usdcBalance = await usdcContract.balanceOf(address);
    const usdcFormatted = ethers.formatUnits(usdcBalance, 6);

    console.log(`
    === Wallet Balances ===
    ETH price (USD): ${ethPriceUSD}
    ETH Balance: ${ethFormatted} ETH
    USDC Balance: ${usdcFormatted} USDC
    `);
        
    document.getElementById("ethBalance").innerText = `ETH Balance: ${parseFloat(ethFormatted).toFixed(4)} ETH`;
    document.getElementById("usdcBalance").innerText = `USDC Balance: ${parseFloat(usdcFormatted).toFixed(2)} USDC`;
  } catch (err) {

      //Console message
      console.error("2 - Balance fetch error:", err);
      document.getElementById("ethBalance").innerText = "ETH Balance: Error";
      document.getElementById("usdcBalance").innerText = "USDC Balance: Error";
  }
}

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

      //Console message
      //console.log("3 - Metamask wallet balance:", "MM");
    
      // Enable controls
      toggleControls(true);

  } catch (err) {

    //Console message
    console.error("4 - Wallet connection error:", err);
    
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

// Optional: Catch uncaught errors globally
window.addEventListener("error", (e) => {
  //Console message
  console.error("12 - Global error:", e);
});
