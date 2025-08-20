// Coin 지갑 메인 페이지 로직

// 전역 변수
let adapter = null;
let currentWallet = null;

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log(`${CoinConfig.name} wallet page loaded`);
  console.log("CoinConfig:", CoinConfig);

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // Sui SDK 확인
  console.log("window.suiSDK:", window.suiSDK);
  console.log("window.suiSDK.generateMnemonic:", window.suiSDK?.generateMnemonic);
  console.log("window.suiSDK.Ed25519Keypair:", window.suiSDK?.Ed25519Keypair);

  // Sui 어댑터 초기화
  adapter = window.getAdapter();
  console.log("Sui adapter initialized:", adapter);

  // UI 테마 적용
  applyTheme();

  // 네트워크 상태 확인
  checkNetworkStatus();

  // 지갑 존재 여부 확인
  checkWalletStatus();

  // 주기적으로 잔액 업데이트 (30초마다)
  setInterval(() => {
    if (currentWallet) {
      updateBalance();
    }
  }, 30000);

  // 트랜잭션 요청 이벤트 리스너 등록
  window.addEventListener("transactionRequest", handleTransactionRequest);
});

// 테마 적용
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);

  document.querySelectorAll(".logo-text").forEach((el) => {
    el.textContent = CoinConfig.theme.logoText;
  });

  document.querySelectorAll(".coin-unit").forEach((el) => {
    el.textContent = CoinConfig.symbol;
  });

  // 네트워크 라벨 설정
  const networkLabel = document.getElementById("network-label");
  if (networkLabel) {
    networkLabel.textContent = CoinConfig.network.networkName.charAt(0).toUpperCase() + 
                              CoinConfig.network.networkName.slice(1);
  }

  // 타이틀 변경
  document.title = `${CoinConfig.name} Wallet`;
  document.querySelector(
    ".creation-title"
  ).textContent = `${CoinConfig.name} Wallet`;
  document.querySelector(
    ".creation-description"
  ).textContent = `Create a secure ${CoinConfig.name} wallet`;
}

// 네트워크 상태 확인
async function checkNetworkStatus() {
  try {
    // 네트워크 상태 확인
    document.getElementById("network-status").style.color = "#4cff4c";
  } catch (error) {
    console.error("Network connection failed:", error);
    document.getElementById("network-status").style.color = "#ff4444";
  }
}

// 지갑 상태 확인
function checkWalletStatus() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const walletData = localStorage.getItem(walletKey);

  if (walletData) {
    try {
      currentWallet = JSON.parse(walletData);

      document.getElementById("wallet-creation").style.display = "none";
      document.getElementById("wallet-main").style.display = "block";

      displayWalletInfo();
      updateBalance();
    } catch (error) {
      console.error("Failed to load wallet:", error);
      showToast("Failed to load wallet");
      resetWallet();
    }
  } else {
    document.getElementById("wallet-creation").style.display = "block";
    document.getElementById("wallet-main").style.display = "none";
  }
}

// 새 지갑 생성 (BIP-39/44 기반)
async function createWallet() {
  console.log("createWallet function called");
  
  if (!window.suiSDK) {
    console.error("Sui SDK not loaded");
    showToast("Sui SDK not available");
    return;
  }

  try {
    console.log("Starting BIP-based wallet creation");
    showToast("Creating secure wallet...");

    // BIP-39 니모닉 생성 (24단어)
    const mnemonic = window.suiSDK.generateMnemonic();
    console.log("BIP-39 mnemonic generated");

    // BIP-44 경로로 키페어 생성 (Sui 표준: m/44'/784'/0'/0'/0')
    const keypair = window.suiSDK.Ed25519Keypair.deriveKeypair(mnemonic, "m/44'/784'/0'/0'/0'");
    console.log("BIP-44 keypair derived:", keypair);
    console.log("Keypair methods:", Object.getOwnPropertyNames(keypair));
    console.log("Keypair prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(keypair)));

    // 주소 생성
    const address = keypair.getPublicKey().toSuiAddress();
    console.log("Address generated:", address);
    
    // 개인키 내보내기
    console.log("Exporting private key...");
    const privateKey = window.suiSDK.exportPrivateKey(keypair);
    console.log("Private key exported:", privateKey);

    console.log("Wallet address:", address);
    console.log("Private key length:", privateKey.length);

    // 니모닉 확인 화면 표시
    showMnemonicConfirmation(mnemonic, address, privateKey);

  } catch (error) {
    console.error("Failed to create wallet:", error);
    console.error("Error stack:", error.stack);
    showToast("Failed to create wallet: " + error.message);
  }
}

// 니모닉 확인 화면 표시
function showMnemonicConfirmation(mnemonic, address, privateKey) {
  // 기존 화면 숨기기
  document.getElementById("wallet-creation").style.display = "none";
  
  // 니모닉 확인 화면 생성
  const confirmationHTML = `
    <div id="mnemonic-confirmation" class="wallet-screen">
      <div class="creation-content">
        <img src="../../assets/icons/app_icon.png" alt="Coin Logo" class="coin-logo-large" />
        <h1 class="creation-title">${CoinConfig.name} Wallet</h1>
        <p class="creation-description">Write down your recovery phrase</p>
        
        <div class="warning-box">
          <p><strong>⚠️ Important:</strong> Write down these 24 words in a secure location. You'll need them to recover your wallet.</p>
        </div>
        
        <div class="mnemonic-display">
          <div class="mnemonic-grid">
            ${mnemonic.split(' ').map((word, index) => 
              `<div class="mnemonic-word">
                <span class="word-number">${index + 1}.</span>
                <span class="word-text">${word}</span>
              </div>`
            ).join('')}
          </div>
        </div>
        
        <div class="confirmation-actions">
          <button class="secondary-btn" onclick="copyMnemonic()">
            Copy to Clipboard
          </button>
          <button class="primary-btn" onclick="confirmMnemonic('${mnemonic}', '${address}', '${privateKey}')">
            I've Written It Down
          </button>
        </div>
        
        <button class="back-btn" onclick="backToCreation()">
          ← Back
        </button>
      </div>
    </div>
  `;
  
  // 화면에 추가
  document.querySelector('.container').insertAdjacentHTML('beforeend', confirmationHTML);
  document.getElementById("mnemonic-confirmation").style.display = "block";
}

// 니모닉 복사
function copyMnemonic() {
  const mnemonicElement = document.querySelector('.mnemonic-display');
  const mnemonic = Array.from(mnemonicElement.querySelectorAll('.word-text'))
    .map(el => el.textContent)
    .join(' ');
  
  navigator.clipboard.writeText(mnemonic).then(() => {
    showToast("Mnemonic copied to clipboard");
  }).catch(() => {
    showToast("Failed to copy mnemonic");
  });
}

// 니모닉 확인 및 지갑 저장
function confirmMnemonic(mnemonic, address, privateKey) {
  // 지갑 데이터 생성
  const walletData = {
    address: address,
    privateKey: privateKey,
    mnemonic: mnemonic,
    createdAt: new Date().toISOString(),
  };

  // localStorage에 저장
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  localStorage.setItem(walletKey, JSON.stringify(walletData));
  currentWallet = walletData;

  console.log("Wallet saved:", address);
  showToast("Wallet created successfully!");

  // 니모닉 확인 화면 제거
  document.getElementById("mnemonic-confirmation").remove();
  
  // 메인 지갑 화면 표시
  document.getElementById("wallet-main").style.display = "block";
  displayWalletInfo();
  updateBalance();
}

// 생성 화면으로 돌아가기
function backToCreation() {
  document.getElementById("mnemonic-confirmation").remove();
  document.getElementById("wallet-creation").style.display = "block";
}

// 니모닉으로 지갑 가져오기 (BIP-39/44 기반)
async function importFromMnemonic() {
  if (!window.suiSDK) {
    showToast("Sui SDK not available");
    return;
  }

  const mnemonicInput = document.getElementById("mnemonic-input").value.trim();

  if (!mnemonicInput) {
    showToast("Please enter mnemonic");
    return;
  }

  // BIP-39 니모닉 유효성 검사
  if (!window.suiSDK.validateMnemonic(mnemonicInput)) {
    showToast("Invalid mnemonic phrase");
    return;
  }

  try {
    showToast("Importing wallet...");

    // BIP-44 경로로 키페어 생성 (Sui 표준: m/44'/784'/0'/0'/0')
    const keypair = window.suiSDK.Ed25519Keypair.deriveKeypair(mnemonicInput, "m/44'/784'/0'/0'/0'");
    
    // 주소 생성
    const address = keypair.getPublicKey().toSuiAddress();
    const privateKey = window.suiSDK.exportPrivateKey(keypair);

    console.log("Wallet imported:", address);

    // localStorage에 저장
    const walletData = {
      address: address,
      privateKey: privateKey,
      mnemonic: mnemonicInput,
      createdAt: new Date().toISOString(),
    };

    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    localStorage.setItem(walletKey, JSON.stringify(walletData));
    currentWallet = walletData;

    showToast("Wallet imported successfully!");

    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";

    displayWalletInfo();
    updateBalance();
  } catch (error) {
    console.error("Failed to import wallet:", error);
    showToast("Failed to import wallet. Please check your mnemonic.");
  }
}

// 개인키로 지갑 가져오기
async function importFromPrivateKey() {
  if (!window.suiSDK) {
    showToast("Sui SDK not available");
    return;
  }

  const privateKeyInput = document
    .getElementById("privatekey-input")
    .value.trim();

  if (!privateKeyInput) {
    showToast("Please enter private key");
    return;
  }

  try {
    showToast("Importing wallet...");

    // 개인키 형식 검증 (0x 접두사 제거)
    let privateKeyHex = privateKeyInput;
    if (privateKeyHex.startsWith('0x')) {
      privateKeyHex = privateKeyHex.slice(2);
    }

    // 개인키 길이 검증 (64자 hex = 32바이트)
    if (privateKeyHex.length !== 64) {
      showToast("Invalid private key length");
      return;
    }

    // 개인키로 키페어 생성
    const privateKeyBytes = new Uint8Array(
      privateKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
    
    const keypair = window.suiSDK.Ed25519Keypair.fromSecretKey(privateKeyBytes);
    
    // 주소 생성
    const address = keypair.getPublicKey().toSuiAddress();

    console.log("Wallet imported from private key:", address);

    // localStorage에 저장
    const walletData = {
      address: address,
      privateKey: privateKeyInput,
      mnemonic: null,
      createdAt: new Date().toISOString(),
    };

    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    localStorage.setItem(walletKey, JSON.stringify(walletData));
    currentWallet = walletData;

    showToast("Wallet imported successfully!");

    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";

    displayWalletInfo();
    updateBalance();
  } catch (error) {
    console.error("Failed to import wallet:", error);
    showToast("Invalid private key format");
  }
}

// 지갑 정보 표시
function displayWalletInfo() {
  if (!currentWallet) return;

  console.log("Displaying wallet info:", currentWallet);

  // 주소 표시
  const addressDisplay = document.getElementById("address-display");
  if (addressDisplay) {
    addressDisplay.textContent = window.shortenAddress(currentWallet.address);
    addressDisplay.title = currentWallet.address; // 전체 주소를 툴팁으로 표시
  }

  // 잔액 업데이트
  updateBalance();
  
  // 디버깅 정보 업데이트
  refreshDebugInfo();
}

// 잔액 업데이트
async function updateBalance() {
  if (!currentWallet || !adapter) return;

  try {
    console.log("Updating balance for address:", currentWallet.address);
    
    const balance = await adapter.getBalance(currentWallet.address);
    console.log("Raw balance:", balance);
    
    const formattedBalance = window.formatBalance(balance, CoinConfig.decimals);
    console.log("Formatted balance:", formattedBalance);
    
    document.getElementById('balance-display').textContent = formattedBalance;
    
    // 잔액이 0일 때 도움말 표시
    if (parseFloat(balance) === 0) {
      const networkName = CoinConfig.network.networkName;
      if (networkName === 'mainnet') {
        showToast('메인넷에서 잔액이 없습니다. 테스트넷으로 전환하거나 거래소에서 SUI를 구매하세요.', 'warning');
      } else {
        showToast('테스트넷에서 잔액이 없습니다. "Get Test SUI" 버튼을 클릭하여 테스트 코인을 받으세요.', 'info');
      }
    }
    
  } catch (error) {
    console.error("Failed to update balance:", error);
    document.getElementById('balance-display').textContent = "Error";
  }
}

// Send 페이지로 이동
function navigateToSend() {
  if (!currentWallet) {
    showToast("No wallet found");
    return;
  }
  // blockchain miniapp은 anamUI 네임스페이스 사용
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/send/send");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/send/send");
  } else {
    // 개발 환경: 일반 HTML 페이지 이동
    window.location.href = "../send/send.html";
  }
}

// Receive 페이지로 이동
function navigateToReceive() {
  if (!currentWallet) {
    showToast("No wallet found");
    return;
  }
  // blockchain miniapp은 anamUI 네임스페이스 사용
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/receive/receive");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/receive/receive");
  } else {
    // 개발 환경: 일반 HTML 페이지 이동
    window.location.href = "../receive/receive.html";
  }
}

// 지갑 초기화
function resetWallet() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  localStorage.removeItem(walletKey);
  currentWallet = null;

  document.getElementById("wallet-main").style.display = "none";
  document.getElementById("wallet-creation").style.display = "block";

  const mnemonicInput = document.getElementById("mnemonic-input");
  const privateKeyInput = document.getElementById("privatekey-input");
  if (mnemonicInput) mnemonicInput.value = "";
  if (privateKeyInput) privateKeyInput.value = "";

  showToast("Wallet reset");
}

// 트랜잭션 요청 처리 (Bridge API)
async function handleTransactionRequest(event) {
  console.log("Transaction request received:", event.detail);

  if (!currentWallet || !adapter) {
    console.error("No wallet found");
    return;
  }

  const requestData = event.detail;
  const requestId = requestData.requestId;

  try {
    // 기본 트랜잭션 파라미터
    const txParams = {
      from: currentWallet.address,
      to: requestData.to || requestData.recipient || requestData.destination,
      amount: requestData.amount || requestData.value,
      privateKey: currentWallet.privateKey,
    };

    const result = await adapter.sendTransaction(txParams);

    const responseData = {
      hash: result.hash || result.txid || result.signature,
      from: currentWallet.address,
      to: txParams.to,
      amount: txParams.amount,
      network: CoinConfig.network.networkName,
      symbol: CoinConfig.symbol,
    };

    if (window.anam && window.anam.sendTransactionResponse) {
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(responseData)
      );
      console.log("Transaction response sent:", responseData);
    }

    setTimeout(updateBalance, 3000);
  } catch (error) {
    console.error("Transaction failed:", error);

    if (window.anam && window.anam.sendTransactionResponse) {
      const errorResponse = {
        error: error.message,
        from: currentWallet.address,
        symbol: CoinConfig.symbol,
      };
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(errorResponse)
      );
    }
  }
}

// HTML onclick을 위한 전역 함수 등록
window.createWallet = createWallet;
window.importFromMnemonic = importFromMnemonic;
window.importFromPrivateKey = importFromPrivateKey;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;
window.resetWallet = resetWallet;

// Faucet에서 테스트 SUI 받기
async function requestFaucet() {
  if (!currentWallet || !adapter) {
    showToast("No wallet found");
    return;
  }

  showToast("Requesting SUI from faucet...");

  try {
    const result = await adapter.requestFaucet(currentWallet.address);
    
    if (result.success) {
      showToast(result.message);
      // 잔액 새로고침
      setTimeout(() => {
        updateBalance();
      }, 2000);
    } else {
      showToast(result.message);
    }
  } catch (error) {
    console.error("Faucet request failed:", error);
    showToast("Failed to request SUI from faucet: " + error.message);
  }
}

// Faucet 함수를 전역으로 등록
window.requestFaucet = requestFaucet;

// 네트워크 전환
async function switchNetwork() {
  try {
    const currentNetwork = CoinConfig.network.networkName;
    const newNetwork = currentNetwork === 'mainnet' ? 'testnet' : 'mainnet';
    
    // 네트워크 설정 업데이트
    if (newNetwork === 'mainnet') {
      CoinConfig.network.rpcEndpoint = "https://fullnode.mainnet.sui.io:443";
      CoinConfig.network.networkName = "mainnet";
      CoinConfig.network.chainId = "0x1";
    } else {
      CoinConfig.network.rpcEndpoint = "https://fullnode.testnet.sui.io:443";
      CoinConfig.network.networkName = "testnet";
      CoinConfig.network.chainId = "0x2";
    }
    
    // 어댑터 재초기화
    adapter = new SuiAdapter(CoinConfig);
    window.setAdapter(adapter);
    
    // UI 업데이트
    applyTheme();
    updateBalance();
    
    console.log(`Switched to ${newNetwork}`);
    showToast(`Switched to ${newNetwork}`, 'success');
    
  } catch (error) {
    console.error('Failed to switch network:', error);
    showToast('Failed to switch network', 'error');
  }
}

// 네트워크 전환 함수를 전역으로 등록
window.switchNetwork = switchNetwork;

// 테스트넷으로 전환
async function switchToTestnet() {
  try {
    // 테스트넷 설정으로 변경
    CoinConfig.network.rpcEndpoint = "https://fullnode.testnet.sui.io:443";
    CoinConfig.network.networkName = "testnet";
    CoinConfig.network.chainId = "0x2";
    
    // 어댑터 재초기화
    adapter = new SuiAdapter(CoinConfig);
    window.setAdapter(adapter);
    
    // UI 업데이트
    applyTheme();
    updateBalance();
    
    console.log('Switched to testnet');
    showToast('테스트넷으로 전환되었습니다. "Get Test SUI" 버튼으로 테스트 코인을 받으세요.', 'success');
    
  } catch (error) {
    console.error('Failed to switch to testnet:', error);
    showToast('테스트넷 전환에 실패했습니다.', 'error');
  }
}

// 테스트넷 전환 함수를 전역으로 등록
window.switchToTestnet = switchToTestnet;

// 디버깅 정보 업데이트
async function refreshDebugInfo() {
  if (!currentWallet || !adapter) return;
  
  try {
    document.getElementById('debug-network').textContent = CoinConfig.network.networkName;
    document.getElementById('debug-address').textContent = currentWallet.address;
    
    const balance = await adapter.getBalance(currentWallet.address);
    document.getElementById('debug-balance').textContent = balance;
    
    console.log('Debug info updated');
  } catch (error) {
    console.error('Failed to update debug info:', error);
    document.getElementById('debug-balance').textContent = 'Error';
  }
}

// 디버깅 함수를 전역으로 등록
window.refreshDebugInfo = refreshDebugInfo;
