let provider;
let signer;
let contract;

const CONTRACT_ADDRESS = "0x9ddd5962f9441a0400be0ab95777381bbfd4ec59";

window.addEventListener('DOMContentLoaded', () => {
  const connectWalletBtn = document.getElementById('connectWalletBtn');
  const swapTokenBtn = document.getElementById('swapTokenBtn');
  const swapEthBtn = document.getElementById('swapEthBtn');
  const pauseBotBtn = document.getElementById('pauseBotBtn');
  const resumeBotBtn = document.getElementById('resumeBotBtn');

  connectWalletBtn.addEventListener('click', connectWallet);
  swapTokenBtn.addEventListener('click', swapTokenForETH);
  swapEthBtn.addEventListener('click', swapETHForToken);
  pauseBotBtn.addEventListener('click', pauseBot);
  resumeBotBtn.addEventListener('click', resumeBot);
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
      console.error("User rejected wallet connection", err);
      alert("Wallet connection rejected.");
    }
  } else {
    alert("Install MetaMask first.");
  }
}

async function swapTokenForETH() {
  const amount = document.getElementById("amountIn").value;
  let slippage = Number(document.getElementById("slippageIn").value);
  const token = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC

  if (slippage > 50) {
    alert("Slippage cannot be more than 50%");
    return;
  }

  try {
    const tx = await contract.swapTokenForETHWithSlippage(token, amount, slippage);
    await tx.wait();
    alert("Swap completed!");
  } catch (err) {
    console.error(err);
    alert("Swap failed.");
  }
}

async function swapETHForToken() {
  const ethAmount = document.getElementById("ethAmount").value;
  let slippage = Number(document.getElementById("slippageOut").value);
  const token = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC

  if (slippage > 50) {
    alert("Slippage cannot be more than 50%");
    return;
  }

  try {
    const tx = await contract.swapETHForTokenWithSlippage(token, slippage, {
      value: ethAmount
    });
    await tx.wait();
    alert("Swap completed!");
  } catch (err) {
    console.error(err);
    alert("Swap failed.");
  }
}

async function pauseBot() {
  try {
    const tx = await contract.pauseBot();
    await tx.wait();
    alert("Bot paused.");
  } catch (err) {
    console.error(err);
    alert("Only the owner can pause the bot.");
  }
}

async function resumeBot() {
  try {
    const tx = await contract.resumeBot();
    await tx.wait();
    alert("Bot resumed.");
  } catch (err) {
    console.error(err);
    alert("Only the owner can resume the bot.");
  }
}
