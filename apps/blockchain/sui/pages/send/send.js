// Send 페이지 로직

// 전역 변수
let adapter = null;
let currentWallet = null;
let pendingTransaction = null;

// 페이지 초기화
document.addEventListener('DOMContentLoaded', function () {
    console.log('=== Send page loaded ===');

    // 지갑 정보 로드
    loadWalletInfo();

    // Sui 어댑터 초기화
    adapter = window.getAdapter();

    console.log('Adapter loaded:', adapter);
    console.log('Adapter type:', typeof adapter);

    if (adapter) {
        console.log('Adapter suiSDK:', adapter.suiSDK);
        console.log('Adapter client:', adapter.client);
        console.log('Adapter config:', adapter.config);
    }

    if (!adapter) {
        console.error('SuiAdapter not initialized');
        showToast('Sui adapter initialization failed');
    }

    // UI 초기화
    console.log('Calling updateUI...');
    updateUI();
});

// 지갑 정보 로드
function loadWalletInfo() {
    console.log('=== loadWalletInfo called ===');

    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    console.log('Wallet key:', walletKey);

    const walletData = localStorage.getItem(walletKey);
    console.log(
        'Wallet data from localStorage:',
        walletData
    );

    if (walletData) {
        try {
            currentWallet = JSON.parse(walletData);
            console.log(
                'Wallet loaded successfully:',
                currentWallet
            );
            console.log(
                'Wallet address:',
                currentWallet.address
            );
            console.log(
                'Wallet has private key:',
                !!currentWallet.privateKey
            );
        } catch (error) {
            console.error(
                'Failed to parse wallet data:',
                error
            );
            showToast('Invalid wallet data');
            goBack();
        }
    } else {
        console.log('No wallet data found in localStorage');
        showToast('No wallet found');
        goBack();
    }
}

// UI 업데이트
async function updateUI() {
    console.log('=== updateUI called ===');

    // 코인 심볼 업데이트
    document
        .querySelectorAll('.coin-symbol')
        .forEach((el) => {
            el.textContent = CoinConfig.symbol;
        });

    // 타이틀 업데이트
    document.title = `Send ${CoinConfig.name}`;

    // 잔액 업데이트
    if (currentWallet && adapter) {
        console.log(
            'Updating balance for wallet:',
            currentWallet.address
        );
        console.log('Adapter:', adapter);

        // 먼저 수동 잔액 확인
        const manualBalance = getManualBalance();
        if (manualBalance !== null) {
            console.log(
                'Using manual balance:',
                manualBalance
            );
            document.getElementById(
                'available-balance'
            ).textContent = manualBalance.toFixed(4);
            return;
        }

        try {
            console.log('Calling adapter.getBalance...');
            const balance = await adapter.getBalance(
                currentWallet.address
            );
            console.log('Raw balance:', balance);

            const formattedBalance = window.formatBalance(
                balance,
                CoinConfig.decimals
            );
            console.log(
                'Formatted balance:',
                formattedBalance
            );

            document.getElementById(
                'available-balance'
            ).textContent = formattedBalance;
            console.log('Balance updated in UI');
        } catch (error) {
            console.error('Failed to get balance:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
            });

            // 에러가 발생해도 기본값 표시
            document.getElementById(
                'available-balance'
            ).textContent = '0.0000';
            showToast(
                "Failed to load balance. Please use 'Set Balance' button to set your actual balance."
            );
        }
    } else {
        console.log('No wallet or adapter available');
        console.log('Current wallet:', currentWallet);
        console.log('Adapter:', adapter);
        document.getElementById(
            'available-balance'
        ).textContent = '0.0000';
    }
}

// 뒤로 가기
function goBack() {
    // blockchain miniapp은 anamUI 네임스페이스 사용
    if (window.anamUI && window.anamUI.navigateTo) {
        window.anamUI.navigateTo('pages/index/index');
    } else if (window.anam && window.anam.navigateTo) {
        window.anam.navigateTo('pages/index/index');
    } else {
        // 개발 환경: 일반 HTML 페이지 이동
        window.location.href = '../index/index.html';
    }
}

// 전송 확인 (트랜잭션 승인 모달 표시)
async function confirmSend() {
    if (!currentWallet || !adapter) {
        showToast('No wallet found');
        return;
    }

    const recipient = document
        .getElementById('recipient-address')
        .value.trim();
    const amount = document
        .getElementById('send-amount')
        .value.trim();
    const feeLevel =
        document.getElementById('tx-fee').value;

    // 유효성 검증
    if (!recipient || !amount) {
        showToast(
            'Please enter recipient address and amount'
        );
        return;
    }

    if (!adapter.isValidAddress(recipient)) {
        showToast('Invalid address format');
        return;
    }

    if (parseFloat(amount) <= 0) {
        showToast('Please enter amount greater than 0');
        return;
    }

    // 잔액 확인
    try {
        console.log('=== Balance check in confirmSend ===');
        console.log(
            'Checking balance for address:',
            currentWallet.address
        );

        // 먼저 수동 잔액 확인
        const manualBalance = getManualBalance();
        let availableBalance;

        if (manualBalance !== null) {
            console.log(
                'Using manual balance:',
                manualBalance
            );
            availableBalance = manualBalance;
        } else {
            console.log(
                'No manual balance, checking API balance...'
            );
            const balance = await adapter.getBalance(
                currentWallet.address
            );
            console.log(
                'Raw balance from adapter:',
                balance
            );
            availableBalance =
                parseFloat(balance) / 1000000000; // MIST to SUI
        }

        const sendAmount = parseFloat(amount);

        console.log(
            'Available balance (SUI):',
            availableBalance
        );
        console.log('Send amount (SUI):', sendAmount);

        if (sendAmount > availableBalance) {
            console.log('Insufficient balance detected');
            showToast(
                `Insufficient balance. Available: ${availableBalance.toFixed(
                    4
                )} SUI`
            );
            return;
        }

        console.log('Balance check passed');
    } catch (error) {
        console.error('Failed to check balance:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
        });

        // 잔액 확인 실패 시에도 전송을 허용 (사용자가 직접 확인)
        console.log(
            'Balance check failed, but allowing transaction to proceed'
        );
        showToast(
            'Warning: Could not verify balance. Please ensure you have sufficient funds.'
        );
    }

    // 트랜잭션 정보 저장
    pendingTransaction = {
        from: currentWallet.address,
        to: recipient,
        amount: amount,
        privateKey: currentWallet.privateKey,
        fee: '0.0001', // 기본 수수료
        feeLevel: feeLevel,
        // 디버깅을 위해 현재 지갑 정보 추가
        walletAddress: currentWallet.address,
    };

    // 트랜잭션 승인 모달 표시
    showTransactionModal();
}

// 트랜잭션 승인 모달 표시
function showTransactionModal() {
    if (!pendingTransaction) return;

    // 모달 내용 업데이트
    document.getElementById('modal-sender').textContent =
        pendingTransaction.from;
    document.getElementById('modal-recipient').textContent =
        pendingTransaction.to;
    document.getElementById(
        'modal-amount'
    ).textContent = `${pendingTransaction.amount} ${CoinConfig.symbol}`;
    document.getElementById(
        'modal-fee'
    ).textContent = `${pendingTransaction.fee} ${CoinConfig.symbol}`;
    document.getElementById('modal-network').textContent =
        CoinConfig.network.networkName;

    // 총 비용 계산
    const totalAmount =
        parseFloat(pendingTransaction.amount) +
        parseFloat(pendingTransaction.fee);
    document.getElementById(
        'modal-total'
    ).textContent = `${totalAmount.toFixed(4)} ${
        CoinConfig.symbol
    }`;

    // 모달 표시
    document.getElementById(
        'transaction-modal'
    ).style.display = 'flex';
}

// 트랜잭션 승인 모달 닫기
function closeTransactionModal() {
    document.getElementById(
        'transaction-modal'
    ).style.display = 'none';
    // pendingTransaction은 executeTransaction에서 null로 설정됨
}

// 실제 트랜잭션 실행
async function executeTransaction() {
    if (!pendingTransaction) {
        showToast('No pending transaction');
        return;
    }

    // 트랜잭션 정보를 미리 저장
    const transactionData = { ...pendingTransaction };

    // 모달 닫기
    closeTransactionModal();

    // 로딩 모달 표시
    showLoadingModal('Preparing transaction...');

    try {
        console.log('=== TRANSACTION DEBUG ===');
        console.log('Transaction data:', transactionData);
        console.log('Adapter:', adapter);
        console.log('Adapter suiSDK:', adapter?.suiSDK);
        console.log('Adapter client:', adapter?.client);

        // 트랜잭션 전송
        updateLoadingMessage('Signing transaction...');
        console.log('Calling adapter.sendTransaction...');

        const result = await adapter.sendTransaction(
            transactionData
        );

        console.log('Transaction result:', result);
        updateLoadingMessage(
            'Transaction sent successfully!'
        );
        console.log('Transaction hash:', result.hash);

        // 로딩 모달 닫기
        setTimeout(() => {
            hideLoadingModal();
            showToast(
                `Transaction sent successfully! Hash: ${result.hash.substring(
                    0,
                    8
                )}...`
            );

            // 메인 페이지로 돌아가기
            setTimeout(() => {
                goBack();
            }, 2000);
        }, 1000);
    } catch (error) {
        console.error('=== TRANSACTION ERROR ===');
        console.error(
            'Error type:',
            error.constructor.name
        );
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error object:', error);

        hideLoadingModal();
        showToast('Transaction failed: ' + error.message);
    } finally {
        pendingTransaction = null;
    }
}

// 로딩 모달 표시
function showLoadingModal(message = 'Processing...') {
    document.getElementById('loading-message').textContent =
        message;
    document.getElementById('loading-modal').style.display =
        'flex';
}

// 로딩 메시지 업데이트
function updateLoadingMessage(message) {
    document.getElementById('loading-message').textContent =
        message;
}

// 로딩 모달 숨기기
function hideLoadingModal() {
    document.getElementById('loading-modal').style.display =
        'none';
}

// HTML onclick을 위한 전역 함수 등록
window.goBack = goBack;
window.confirmSend = confirmSend;
window.closeTransactionModal = closeTransactionModal;
window.executeTransaction = executeTransaction;

// Faucet에서 테스트 SUI 받기
async function requestFaucet() {
    if (!currentWallet || !adapter) {
        showToast('No wallet found');
        return;
    }

    showLoadingModal('Requesting SUI from faucet...');

    try {
        const result = await adapter.requestFaucet(
            currentWallet.address
        );

        hideLoadingModal();

        if (result.success) {
            showToast(result.message);
            // 잔액 새로고침
            setTimeout(() => {
                updateUI();
            }, 2000);
        } else {
            // Faucet 실패 시 수동 안내
            const message = result.message;
            showToast(message);

            // 수동 Faucet 링크가 있는 경우 사용자에게 안내
            if (result.faucetUrl) {
                setTimeout(() => {
                    const shouldOpen = confirm(
                        'Faucet API failed. Would you like to open the Sui Explorer Faucet in a new tab?'
                    );
                    if (shouldOpen) {
                        window.open(
                            result.faucetUrl,
                            '_blank'
                        );
                    }
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Faucet request failed:', error);
        hideLoadingModal();

        // 에러 발생 시 수동 Faucet 안내
        const faucetUrl = `https://suiexplorer.com/faucet?address=${currentWallet.address}`;
        showToast(
            'Faucet request failed. Please use the manual faucet.'
        );

        setTimeout(() => {
            const shouldOpen = confirm(
                'Would you like to open the Sui Explorer Faucet in a new tab?'
            );
            if (shouldOpen) {
                window.open(faucetUrl, '_blank');
            }
        }, 1000);
    }
}

// Faucet 함수를 전역으로 등록
window.requestFaucet = requestFaucet;

// 수동 잔액 설정
function setManualBalance() {
    const manualBalance = prompt(
        'Enter your actual SUI balance (e.g., 1.0):',
        '1.0'
    );

    if (
        manualBalance &&
        !isNaN(parseFloat(manualBalance))
    ) {
        // localStorage에 수동 잔액 저장
        localStorage.setItem(
            'manual_sui_balance',
            manualBalance
        );

        // UI 업데이트
        document.getElementById(
            'available-balance'
        ).textContent =
            parseFloat(manualBalance).toFixed(4);

        showToast(`Balance set to ${manualBalance} SUI`);
        console.log('Manual balance set:', manualBalance);
    } else if (manualBalance !== null) {
        showToast('Please enter a valid number');
    }
}

// 수동 잔액 가져오기
function getManualBalance() {
    const manualBalance = localStorage.getItem(
        'manual_sui_balance'
    );
    if (manualBalance) {
        return parseFloat(manualBalance);
    }
    return null;
}

// 수동 잔액 설정 함수를 전역으로 등록
window.setManualBalance = setManualBalance;
