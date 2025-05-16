let provider;
let signer;
let contract;
let balanceInterval = null; // Add this at the top of app.js

const CONTRACT_ADDRESS = "0x9ddd5962f9441a0400be0ab95777381bbfd4ec59"; // ✅ Your deployed contract
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // ✅ USDC Mainnet
const CONTRACT_ABI = window.CONTRACT_ABI; // ✅ Contract ABI

const usdcAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"  // <-- added here
];

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("swapTokenBtn").addEventListener("click", swapTokenForETH);
  document.getElementById("swapEthBtn").addEventListener("click", swapETHForToken);
  document.getElementById("pauseBotBtn").addEventListener("click", pauseBot);
  document.getElementById("resumeBotBtn").addEventListener("click", resumeBot);
});

async function connectWallet() {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const address = await signer.getAddress();
      document.getElementById("walletAddress").innerText = "Connected: " + address;
      await updateBalances(address); // 👈 Initial fetch

      // ✅ Refresh balances every 30 seconds
      // Save interval ID so you can clear it later if needed
      balanceInterval = setInterval(async () => {
        const currentAddress = await signer.getAddress();
        await updateBalances(currentAddress);
      }, 30000);
      
      /*
      setInterval(async () => {
        const currentAddress = await signer.getAddress();
        await updateBalances(currentAddress);
      }, 30000);
      */
      
    } catch (err) {
      console.error("Wallet connection error:", err);
      alert("Failed to connect wallet.");
    }
  } else {
    alert("Please install MetaMask.");
  }
}

async function updateBalances(address) {
  try {
    const ethBalance = await provider.getBalance(address);
    const ethFormatted = ethers.formatEther(ethBalance);
    document.getElementById("ethBalance").innerText = `ETH Balance: ${parseFloat(ethFormatted).toFixed(4)} ETH`;

    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
    const usdcBalance = await usdcContract.balanceOf(address);
    const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
    
    document.getElementById("usdcBalance").innerText = `USDC Balance: ${parseFloat(usdcFormatted).toFixed(2)} USDC`;
  } catch (err) {
    console.error("Balance fetch error:", err);
    document.getElementById("ethBalance").innerText = "ETH Balance: Error";
    document.getElementById("usdcBalance").innerText = "USDC Balance: Error";
  }
}

async function swapTokenForETH() {
  const swapBtn = document.getElementById("swapTokenBtn");
  swapBtn.disabled = true; // Disable button immediately to prevent double submissions
  
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
    const amountIn = ethers.parseUnits(amount, 6); // ✅ USDC has 6 decimals

    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
    const ownerAddress = await signer.getAddress();

    // Check current allowance
    const allowance = await usdcContract.allowance(ownerAddress, CONTRACT_ADDRESS);

    // Approve contract if allowance insufficient
    if (allowance.lt(amountIn)) {
      const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, amountIn);
      await approveTx.wait();
      console.log("USDC approved for contract.");
    }

    // Call swap function on your contract
    const tx = await contract.swapTokenForETHWithSlippage(USDC_ADDRESS, amountIn, slippage);
    await tx.wait();
    
    alert("USDC → ETH swap completed!");
    await updateBalances(await signer.getAddress());
  } catch (err) {
    console.error("swapTokenForETH error:", err);
    alert("Swap failed. See console for details.");
  } finally {
    swapBtn.disabled = false; // Re-enable button
  }
}

async function swapETHForToken() {
  const swapEthBtn = document.getElementById("swapEthBtn");
  swapEthBtn.disabled = true; // Disable button immediately to prevent double submissions
  
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
    
    const tx = await contract.swapETHForTokenWithSlippage(USDC_ADDRESS, slippage, { value });
    await tx.wait();
    alert("ETH → USDC swap completed!");
    await updateBalances(await signer.getAddress());
  } catch (err) {
    console.error("swapETHForToken error:", err);
    alert("Swap failed. See console for details.");
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
    console.error("pauseBot error:", err);
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
    console.error("resumeBot error:", err);
    alert("Resume failed. Are you the contract owner?");
  } finally {
    resumeBtn.disabled = false;
  }
}
