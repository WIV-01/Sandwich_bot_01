let provider;
let signer;
let contract;

const CONTRACT_ADDRESS = "0x9ddd5962f9441a0400be0ab95777381bbfd4ec59"; // ✅ Your deployed contract
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // ✅ USDC Mainnet
const CONTRACT_ABI = window.CONTRACT_ABI; // ✅ Contract ABI

const usdcAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)"
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
    } catch (err) {
      console.error("Wallet connection error:", err);
      alert("Failed to connect wallet.");
    }
  } else {
    alert("Please install MetaMask.");
  }
}

async function swapTokenForETH() {
  const amount = document.getElementById("amountIn").value.trim();
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    alert("Please enter a valid USDC amount greater than 0.");
    return;
  }

  const slippage = Number(document.getElementById("slippageIn").value);
  if (isNaN(slippage) || slippage < 0 || slippage > 50) {
    alert("Slippage must be a number between 0 and 50.");
    return;
  }

  try {
    const amountIn = ethers.parseUnits(amount, 6); // ✅ USDC has 6 decimals

    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
    const ownerAddress = await signer.getAddress();
    const allowance = await usdcContract.allowance(ownerAddress, CONTRACT_ADDRESS);

    if (allowance.lt(amountIn)) {
      const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, amountIn);
      await approveTx.wait();
      console.log("USDC approved for contract.");
    }

    const tx = await contract.swapTokenForETHWithSlippage(USDC_ADDRESS, amountIn, slippage);
    await tx.wait();
    alert("USDC → ETH swap completed!");
  } catch (err) {
    console.error("swapTokenForETH error:", err);
    alert("Swap failed. See console for details.");
  }
}

async function swapETHForToken() {
  const ethAmount = document.getElementById("ethAmount").value.trim(); 
  
  if (!ethAmount || isNaN(ethAmount) || Number(ethAmount) <= 0) {
    alert("Please enter a valid ETH amount greater than 0.");
    return;
  }

  const slippage = Number(document.getElementById("slippageOut").value);
  if (isNaN(slippage) || slippage < 0 || slippage > 50) {
    alert("Slippage must be a number between 0 and 50.");
    return;
  }

  try {
    const value = ethers.parseEther(ethAmount); // ✅ ETH has 18 decimals
    const tx = await contract.swapETHForTokenWithSlippage(USDC_ADDRESS, slippage, { value });
    await tx.wait();
    alert("ETH → USDC swap completed!");
  } catch (err) {
    console.error("swapETHForToken error:", err);
    alert("Swap failed. See console for details.");
  }
}

async function pauseBot() {
  try {
    const tx = await contract.pauseBot();
    await tx.wait();
    alert("Bot paused.");
  } catch (err) {
    console.error("pauseBot error:", err);
    alert("Pause failed. Are you the contract owner?");
  }
}

async function resumeBot() {
  try {
    const tx = await contract.resumeBot();
    await tx.wait();
    alert("Bot resumed.");
  } catch (err) {
    console.error("resumeBot error:", err);
    alert("Resume failed. Are you the contract owner?");
  }
}
