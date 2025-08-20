// ================================================================
// COIN 미니앱 전역 설정 및 초기화
// ================================================================

// Coin 설정
const CoinConfig = {
    // 기본 정보
    name: 'Sui',
    symbol: 'SUI',
    decimals: 9,

    // 네트워크 설정
    network: {
        // Sui RPC 엔드포인트
        rpcEndpoint: 'https://fullnode.testnet.sui.io:443',
        // 네트워크 이름
        networkName: 'testnet', // 예: "mainnet", "testnet", "devnet"
        // Sui는 chainId 사용
        chainId: '0x2',
    },

    // UI 테마 설정
    theme: {
        primaryColor: '#6FBDFF', // 메인 색상 (Sui Blue)
        secondaryColor: '#FF6B6B', // 보조 색상 (Sui Red)
        logoText: 'Sui', // 로고 텍스트
    },

    // 주소 설정
    address: {
        // 주소 형식 정규식 (검증용) - Sui는 0x로 시작하는 64자 hex
        regex: /^0x[a-fA-F0-9]{64}$/,
        // 주소 표시 형식
        displayFormat: '0x...', // Hex 형식
    },

    // 트랜잭션 설정
    transaction: {
        // 기본 가스비/수수료
        defaultFee: '0.0001', // 100000 MIST
        // 최소 전송 금액
        minAmount: '0.000001',
        // 확인 대기 시간 (ms)
        confirmationTime: 15000,
    },

    // 기타 옵션
    options: {
        // 니모닉 지원 여부
        supportsMnemonic: true,
        // 토큰 지원 여부 (Sui 토큰)
        supportsTokens: true,
        // QR 코드 지원
        supportsQRCode: true,
    },
};

// Coin Adapter 추상 클래스
// 모든 블록체인 지갑이 구현해야 하는 공통 인터페이스
class CoinAdapter {
    constructor(config) {
        if (this.constructor === CoinAdapter) {
            throw new Error(
                'CoinAdapter is an abstract class. Cannot be instantiated directly.'
            );
        }
        this.config = config;
    }

    /* ================================================================
     * 1. 지갑 생성 및 관리
     * ================================================================ */

    /**
     * 새 지갑 생성
     * @returns {Promise<{address: string, privateKey: string, mnemonic?: string}>}
     */
    async generateWallet() {
        throw new Error(
            'generateWallet() method must be implemented.'
        );
    }

    /**
     * 니모닉으로 지갑 복구
     * @param {string} mnemonic - 니모닉 구문
     * @returns {Promise<{address: string, privateKey: string}>}
     */
    async importFromMnemonic(mnemonic) {
        throw new Error(
            'importFromMnemonic() method must be implemented.'
        );
    }

    /**
     * 개인키로 지갑 복구
     * @param {string} privateKey - 개인키
     * @returns {Promise<{address: string}>}
     */
    async importFromPrivateKey(privateKey) {
        throw new Error(
            'importFromPrivateKey() method must be implemented.'
        );
    }

    /**
     * 주소 유효성 검증
     * @param {string} address - 검증할 주소
     * @returns {boolean}
     */
    isValidAddress(address) {
        throw new Error(
            'isValidAddress() method must be implemented.'
        );
    }

    /* ================================================================
     * 2. 잔액 조회
     * ================================================================ */

    /**
     * 주소의 잔액 조회
     * @param {string} address - 조회할 주소
     * @returns {Promise<string>} - 잔액 (최소 단위)
     */
    async getBalance(address) {
        throw new Error(
            'getBalance() method must be implemented.'
        );
    }

    /* ================================================================
     * 3. 트랜잭션 처리
     * ================================================================ */

    /**
     * 트랜잭션 전송
     * @param {Object} params - 트랜잭션 파라미터
     * @param {string} params.to - 수신자 주소
     * @param {string} params.amount - 전송 금액
     * @param {string} params.privateKey - 발신자 개인키
     * @param {string} params.feeLevel - 수수료 레벨 (low, medium, high)
     * @returns {Promise<{hash: string, signature: string}>}
     */
    async sendTransaction(params) {
        console.log('=== sendTransaction called ===');
        await this.initSDK();
        const {
            to,
            amount,
            privateKey,
            feeLevel = 'medium',
        } = params;

        if (!(await this.isValidAddress(to))) {
            throw new Error('Invalid address');
        }

        await this.initProvider();

        // 🔑 키페어 복원 (패치 2 로직)
        console.log('=== PRIVATE KEY FORMAT DETECTION ===');
        console.log('Private key value:', privateKey);
        console.log('Private key type:', typeof privateKey);

        let keypair;
        let bytes;

        // SUI 표준 형식 (suiprivkey1...) 처리
        if (
            typeof privateKey === 'string' &&
            privateKey.startsWith('suiprivkey1')
        ) {
            console.log('✅ Detected suiprivkey1 format');

            try {
                // suiprivkey1 형식에서 키페어 직접 생성
                keypair =
                    this.suiSDK.Ed25519Keypair.fromSecretKey(
                        privateKey
                    );
                console.log(
                    'Successfully created keypair from suiprivkey1 format'
                );
            } catch (error) {
                console.error(
                    'Failed to create keypair from suiprivkey1:',
                    error
                );
                throw new Error(
                    'Invalid suiprivkey1 format: ' +
                        error.message
                );
            }
        }
        // CSV 형식 ("170,172,251,...") 처리
        else if (
            typeof privateKey === 'string' &&
            privateKey.includes(',')
        ) {
            console.log('✅ Detected CSV format');

            bytes = privateKey
                .split(',')
                .map((x) => Number(x.trim()));
            console.log('Parsed CSV bytes:', bytes);
        }
        // 다른 형식들
        else {
            console.log(
                '⚠️ Unknown private key format, trying as CSV'
            );
            bytes = privateKey
                .split(',')
                .map((x) => Number(x.trim()));
        }

        // CSV 형식인 경우 키페어 생성
        if (bytes && !keypair) {
            // 실제 존재하는 메서드 확인
            const hasFromSeed =
                typeof this.suiSDK.Ed25519Keypair
                    .fromSeed === 'function';
            const hasFromSecretKey =
                typeof this.suiSDK.Ed25519Keypair
                    .fromSecretKey === 'function';

            console.log('=== SUI KEYPAIR DEBUG (CSV) ===');
            console.log('Private key string:', privateKey);
            console.log('Private key bytes:', bytes);
            console.log(
                'Private key bytes length:',
                bytes.length
            );
            console.log('Available methods:', {
                hasFromSeed,
                hasFromSecretKey,
            });
            console.log('Key length:', bytes.length);

            // 현재 지갑 주소 정보 (참조용)
            console.log('=== WALLET CONTEXT ===');
            console.log('Transaction recipient (to):', to);
            console.log(
                'Transaction sender (from):',
                params.from
            );
            console.log(
                'Wallet address from params:',
                params.walletAddress
            );
            console.log('Transaction amount:', amount);
            console.log('Fee level:', feeLevel);
            console.log(
                'Private key (first 20 chars):',
                privateKey.substring(0, 20) + '...'
            );

            if (bytes.length === 32) {
                if (hasFromSeed) {
                    keypair =
                        this.suiSDK.Ed25519Keypair.fromSeed(
                            Uint8Array.from(bytes)
                        );
                    console.log(
                        'Keypair created using fromSeed:',
                        keypair
                    );
                } else if (hasFromSecretKey) {
                    // 32바이트를 그대로 전달 (확장하지 않음)
                    keypair =
                        this.suiSDK.Ed25519Keypair.fromSecretKey(
                            Uint8Array.from(bytes)
                        );
                    console.log(
                        'Keypair created using fromSecretKey:',
                        keypair
                    );
                } else {
                    throw new Error(
                        'No compatible keypair creation method found'
                    );
                }
            } else if (
                bytes.length === 64 &&
                hasFromSecretKey
            ) {
                keypair =
                    this.suiSDK.Ed25519Keypair.fromSecretKey(
                        Uint8Array.from(bytes)
                    );
                console.log(
                    'Keypair created using fromSecretKey (64 bytes):',
                    keypair
                );
            } else if (bytes.length > 32 && hasFromSeed) {
                // 일부 케이스: 70바이트 같은 확장 포맷이 들어오는 경우 앞 32바이트만 씨드로 사용
                keypair =
                    this.suiSDK.Ed25519Keypair.fromSeed(
                        Uint8Array.from(bytes.slice(0, 32))
                    );
                console.log(
                    'Keypair created using fromSeed (truncated):',
                    keypair
                );
            } else {
                throw new Error(
                    `Unsupported private key length: ${bytes.length}. Available methods: fromSeed=${hasFromSeed}, fromSecretKey=${hasFromSecretKey}`
                );
            }

            // 생성된 키페어의 상세 정보 출력
            console.log('=== KEYPAIR DETAILS ===');
            console.log('Keypair type:', typeof keypair);
            console.log(
                'Keypair constructor:',
                keypair.constructor.name
            );
            console.log(
                'Keypair methods:',
                Object.getOwnPropertyNames(keypair)
            );
            console.log(
                'Keypair prototype methods:',
                Object.getOwnPropertyNames(
                    Object.getPrototypeOf(keypair)
                )
            );

            // 공개키 정보
            let publicKey;
            let address;
            try {
                publicKey = keypair.getPublicKey();
                console.log('=== PUBLIC KEY DETAILS ===');
                console.log(
                    'Public key object:',
                    publicKey
                );
                console.log(
                    'Public key type:',
                    typeof publicKey
                );
                console.log(
                    'Public key constructor:',
                    publicKey.constructor.name
                );
                console.log(
                    'Public key methods:',
                    Object.getOwnPropertyNames(publicKey)
                );
                console.log(
                    'Public key prototype methods:',
                    Object.getOwnPropertyNames(
                        Object.getPrototypeOf(publicKey)
                    )
                );

                // 주소 생성 과정 상세 디버깅
                address = publicKey.toSuiAddress();
                console.log(
                    '=== ADDRESS GENERATION DETAILS ==='
                );
                console.log('Generated address:', address);
                console.log(
                    'Address type:',
                    typeof address
                );
                console.log(
                    'Address length:',
                    address.length
                );
                console.log(
                    'Address starts with 0x:',
                    address.startsWith('0x')
                );
                console.log(
                    'Is valid Sui address format:',
                    /^0x[a-fA-F0-9]{64}$/.test(address)
                );

                // 원본 지갑 주소와 비교
                console.log('=== ADDRESS COMPARISON ===');
                console.log(
                    'Generated sender address (from keypair):',
                    address
                );
                console.log(
                    'Target recipient address (to):',
                    to
                );
                console.log(
                    'Stored wallet address (from):',
                    params.from
                );
                console.log(
                    'Wallet address from params:',
                    params.walletAddress
                );

                // 주소 일치성 검사
                const senderMatchesWallet =
                    address === params.from;
                const senderMatchesWalletParam =
                    address === params.walletAddress;
                const fromMatchesWalletParam =
                    params.from === params.walletAddress;

                console.log(
                    '=== ADDRESS CONSISTENCY CHECK ==='
                );
                console.log(
                    'Sender from keypair matches stored "from":',
                    senderMatchesWallet
                );
                console.log(
                    'Sender from keypair matches wallet param:',
                    senderMatchesWalletParam
                );
                console.log(
                    'Stored "from" matches wallet param:',
                    fromMatchesWalletParam
                );

                // 문제가 있는 경우 경고
                if (
                    !senderMatchesWallet ||
                    !senderMatchesWalletParam
                ) {
                    console.warn(
                        '⚠️ ADDRESS MISMATCH DETECTED!'
                    );
                    console.warn(
                        'This could indicate a problem with keypair generation or address derivation'
                    );
                    console.warn(
                        'Expected address:',
                        params.from || params.walletAddress
                    );
                    console.warn(
                        'Generated address:',
                        address
                    );
                } else {
                    console.log(
                        '✅ All addresses match correctly'
                    );
                }
            } catch (error) {
                console.error(
                    'Error getting public key or address:',
                    error
                );
                throw error;
            }
        } // CSV 형식 처리 블록 종료

        // 🔢 SUI → MIST BigInt 변환 (정밀도 안전)
        const toMist = (val) => {
            const s = String(val).trim();
            if (!/^\d+(\.\d+)?$/.test(s))
                throw new Error('Invalid amount format');
            const [i, f = ''] = s.split('.');
            const frac = (f + '0'.repeat(9)).slice(0, 9);
            return (
                BigInt(i) * 1_000_000_000n + BigInt(frac)
            );
        };
        const mist = toMist(amount);

        // ✅ 1순위: 번들에 sendSui가 있으면 그대로 사용
        if (this.suiSDK.sendSui) {
            const res = await this.suiSDK.sendSui(
                this.client,
                keypair,
                to,
                amount
            );
            const hash =
                res?.digest ??
                res?.effectsDigest ??
                res?.hash ??
                '(no-digest)';
            return { hash, signature: hash };
        }

        // ✅ 2순위: 새 API(Transaction)로 직접 전송
        if (
            this.suiSDK.Transaction &&
            this.client.signAndExecuteTransaction
        ) {
            const tx = new this.suiSDK.Transaction();
            // 가스 예산(예시)
            const gasBudget =
                feeLevel === 'high'
                    ? 2_000_000n
                    : feeLevel === 'low'
                    ? 400_000n
                    : 1_000_000n;
            tx.setGasBudget(gasBudget);
            const [coin] = tx.splitCoins(tx.gas, [
                tx.pure.u64(mist),
            ]);
            tx.transferObjects([coin], tx.pure.address(to));

            const res =
                await this.client.signAndExecuteTransaction(
                    {
                        signer: keypair,
                        transaction: tx,
                        options: {
                            showEffects: true,
                            showObjectChanges: true,
                        },
                        requestType:
                            'WaitForLocalExecution',
                    }
                );

            const hash =
                res?.digest ??
                res?.effectsDigest ??
                '(no-digest)';
            return { hash, signature: hash };
        }

        // ✅ 3순위: 레거시(TransactionBlock) 경로
        if (
            this.suiSDK.TransactionBlock &&
            this.client.signAndExecuteTransactionBlock
        ) {
            const tx = new this.suiSDK.TransactionBlock();
            // tx.setSender(keypair.getPublicKey().toSuiAddress()); // 보통 생략 가능
            // 버전에 따라 pure 시그니처가 다름
            const pureU64 = tx.pure?.u64
                ? (x) => tx.pure.u64(x)
                : (x) => tx.pure(x);
            const pureAddr = tx.pure?.address
                ? (x) => tx.pure.address(x)
                : (x) => tx.pure(x);

            const [coin] = tx.splitCoins(tx.gas, [
                pureU64(mist),
            ]);
            tx.transferObjects([coin], pureAddr(to));

            const res =
                await this.client.signAndExecuteTransactionBlock(
                    {
                        signer: keypair,
                        transactionBlock: tx,
                        options: {
                            showEffects: true,
                            showObjectChanges: true,
                        },
                        requestType:
                            'WaitForLocalExecution',
                    }
                );

            const hash =
                res?.digest ??
                res?.effectsDigest ??
                '(no-digest)';
            return { hash, signature: hash };
        }

        throw new Error(
            'No compatible Sui transaction API found in your bundle.'
        );
    }

    /**
     * 트랜잭션 상태 조회
     * @param {string} txHash - 트랜잭션 해시
     * @returns {Promise<{status: string, confirmations: number}>}
     */
    async getTransactionStatus(txHash) {
        throw new Error(
            'getTransactionStatus() method must be implemented.'
        );
    }

    /* ================================================================
     * 4. 수수료 관련
     * ================================================================ */

    /**
     * 현재 네트워크 수수료 조회
     * @returns {Promise<{low: string, medium: string, high: string}>}
     */
    async getGasPrice() {
        throw new Error(
            'getGasPrice() method must be implemented.'
        );
    }

    /**
     * 트랜잭션 수수료 예상
     * @param {Object} txParams - 트랜잭션 파라미터
     * @returns {Promise<string>} - 예상 수수료
     */
    async estimateFee(txParams) {
        throw new Error(
            'estimateFee() method must be implemented.'
        );
    }
}

// ================================================================
// 미니앱 생명주기 정의
// ================================================================

// 전역 앱 상태 관리
const AppState = {
    isInitialized: false,
    walletData: null,
    config: CoinConfig,
    adapter: null, // 실제 구현체에서 설정
};

// 미니앱 생명주기 핸들러
window.App = {
    // 앱 시작 시 호출 (최초 1회)
    onLaunch(options) {
        console.log('MiniApp started:', options);

        this.initializeApp();

        this.loadWalletData();

        this.startNetworkMonitoring();
    },

    // 앱이 포그라운드로 전환될 때
    onShow(options) {
        console.log('MiniApp activated:', options);

        if (AppState.walletData?.address) {
            this.refreshBalance();
        }

        this.checkNetworkStatus();
    },

    // 앱이 백그라운드로 전환될 때
    onHide() {
        console.log('MiniApp deactivated');
    },

    // 앱 오류 발생 시
    onError(error) {
        console.error('MiniApp error:', error);
    },

    // ================================================================
    // 초기화 메서드
    // ================================================================

    initializeApp() {
        if (AppState.isInitialized) return;

        this.validateConfig();

        AppState.isInitialized = true;
    },

    validateConfig() {
        const required = ['name', 'symbol', 'network'];
        for (const field of required) {
            if (!CoinConfig[field]) {
                throw new Error(
                    `Required config missing: ${field}`
                );
            }
        }
    },

    // ================================================================
    // 데이터 관리
    // ================================================================

    loadWalletData() {
        try {
            const stored =
                localStorage.getItem('walletData');
            if (stored) {
                AppState.walletData = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load wallet data:', e);
        }
    },

    saveWalletData(data) {
        try {
            AppState.walletData = data;
            localStorage.setItem(
                'walletData',
                JSON.stringify(data)
            );
        } catch (e) {
            console.error('Failed to save wallet data:', e);
        }
    },

    // ================================================================
    // 네트워크 관리
    // ================================================================

    startNetworkMonitoring() {
        console.log('Network monitoring started');
    },

    checkNetworkStatus() {
        return true;
    },

    // ================================================================
    // 비즈니스 로직
    // ================================================================

    async refreshBalance() {
        if (
            !AppState.adapter ||
            !AppState.walletData?.address
        )
            return;

        try {
            const balance =
                await AppState.adapter.getBalance(
                    AppState.walletData.address
                );
            console.log('Balance updated:', balance);
        } catch (e) {
            console.error('Failed to get balance:', e);
        }
    },
};

// ================================================================
// 전역 유틸리티 함수
// ================================================================

// 설정 접근자
window.getConfig = () => AppState.config;

// 어댑터 접근자
window.getAdapter = () => AppState.adapter;

// 어댑터 설정 (각 코인 구현체에서 호출)
window.setAdapter = (adapter) => {
    if (!(adapter instanceof CoinAdapter)) {
        throw new Error(
            'Not a valid CoinAdapter instance.'
        );
    }
    AppState.adapter = adapter;
};

// ================================================================
// 공통 유틸리티 함수
// ================================================================

// Toast 메시지 표시
window.showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// 잔액을 사람이 읽기 쉬운 형식으로 변환
window.formatBalance = (balance, decimals = 18) => {
    const value = Number(balance) / Math.pow(10, decimals);
    return value.toFixed(4);
};

// 금액을 최소 단위로 변환
window.parseAmount = (amount, decimals = 18) => {
    const value =
        parseFloat(amount) * Math.pow(10, decimals);
    return value.toString();
};

// 주소 축약 표시
window.shortenAddress = (address, chars = 4) => {
    if (!address) return '';
    return `${address.slice(
        0,
        chars + 2
    )}...${address.slice(-chars)}`;
};

// ================================================================
// Sui Adapter 구현
// ================================================================

// Sui 어댑터 구현
class SuiAdapter extends CoinAdapter {
    constructor(config) {
        super(config);
        this.client = null;
        this.suiSDK = null;

        // suiSDK 로딩 상태 확인
        console.log(
            'SuiAdapter constructor - window.suiSDK:',
            window.suiSDK
        );
        console.log(
            'window.suiSDK type:',
            typeof window.suiSDK
        );

        if (window.suiSDK) {
            console.log(
                'SUCCESS: window.suiSDK loaded successfully'
            );
            console.log(
                'Available suiSDK methods:',
                Object.keys(window.suiSDK)
            );
            this.suiSDK = window.suiSDK;
        } else {
            console.log(
                'window.suiSDK not available, will load from bundle when needed'
            );
        }
    }

    // SDK 초기화
    async initSDK() {
        if (this.suiSDK) return this.suiSDK;
        if (window.suiSDK) {
            this.suiSDK = window.suiSDK;
            return this.suiSDK;
        }
        throw new Error(
            "sui-bundle not loaded. Include <script src='../../assets/sui-bundle.umd.js'></script> BEFORE app.js/send.js"
        );
    }

    // RPC 클라이언트 초기화
    async initProvider() {
        console.log('=== initProvider called ===');
        console.log('Current client:', this.client);
        console.log('Config network:', this.config.network);

        if (!this.client) {
            console.log('Creating new SuiClient...');
            console.log(
                'RPC URL:',
                this.config.network.rpcEndpoint
            );

            try {
                this.client = new this.suiSDK.SuiClient({
                    url: this.config.network.rpcEndpoint,
                });
                console.log(
                    'SuiClient created successfully:',
                    this.client
                );

                // 클라이언트 연결 테스트
                console.log('Testing client connection...');
                try {
                    const testResponse =
                        await this.client.getLatestSuiSystemState();
                    console.log(
                        'Client connection test successful:',
                        testResponse
                    );
                } catch (testError) {
                    console.error(
                        'Client connection test failed:',
                        testError
                    );
                    // 연결 테스트 실패해도 계속 진행
                }
            } catch (error) {
                console.error(
                    'Failed to create SuiClient:',
                    error
                );
                throw error;
            }
        } else {
            console.log('Using existing client');
        }

        return this.client;
    }

    // 새 지갑 생성
    async generateWallet() {
        console.log('SuiAdapter.generateWallet() called');

        // SDK 초기화
        await this.initSDK();
        console.log('this.suiSDK:', this.suiSDK);

        try {
            // 니모닉 생성
            console.log('Generating mnemonic...');
            const mnemonic = this.suiSDK.generateMnemonic();
            console.log('Mnemonic generated:', mnemonic);

            // 니모닉으로부터 키페어 생성
            console.log(
                'Creating keypair from mnemonic...'
            );
            const keypair =
                this.suiSDK.Ed25519Keypair.deriveKeypair(
                    mnemonic
                );
            console.log('Keypair created:', keypair);

            const address = keypair
                .getPublicKey()
                .toSuiAddress();

            // 개인키 내보내기 (여러 방법 시도)
            console.log(
                '=== GENERATE WALLET KEYPAIR DEBUG ==='
            );
            console.log('Keypair object:', keypair);
            console.log(
                'Available keypair methods:',
                Object.getOwnPropertyNames(keypair)
            );
            console.log(
                'Available keypair prototype methods:',
                Object.getOwnPropertyNames(
                    Object.getPrototypeOf(keypair)
                )
            );

            let privateKeyBytes;
            if (
                typeof keypair.exportSecretKey ===
                'function'
            ) {
                privateKeyBytes = keypair.exportSecretKey();
                console.log(
                    'Private key exported using exportSecretKey:',
                    privateKeyBytes
                );
            } else if (
                typeof keypair.export === 'function'
            ) {
                const exported = keypair.export();
                console.log(
                    'Keypair export result:',
                    exported
                );
                privateKeyBytes = exported.privateKey;
                console.log(
                    'Private key from export.privateKey:',
                    privateKeyBytes
                );
            } else if (
                typeof keypair.getSecretKey === 'function'
            ) {
                privateKeyBytes = keypair.getSecretKey();
                console.log(
                    'Private key from getSecretKey:',
                    privateKeyBytes
                );
            } else if (keypair.secretKey) {
                privateKeyBytes = keypair.secretKey;
                console.log(
                    'Private key from keypair.secretKey:',
                    privateKeyBytes
                );
            } else if (keypair.privateKey) {
                privateKeyBytes = keypair.privateKey;
                console.log(
                    'Private key from keypair.privateKey:',
                    privateKeyBytes
                );
            } else {
                console.error(
                    'No known method to export private key from keypair'
                );
                throw new Error(
                    'No known method to export private key from keypair'
                );
            }

            // Ed25519 개인키는 32바이트여야 함
            // 만약 64바이트라면 (개인키 + 공개키), 앞의 32바이트만 사용
            if (privateKeyBytes.length === 64) {
                console.log(
                    '64-byte key detected, using first 32 bytes'
                );
                privateKeyBytes = privateKeyBytes.slice(
                    0,
                    32
                );
            } else if (privateKeyBytes.length !== 32) {
                throw new Error(
                    `Invalid private key length: ${privateKeyBytes.length} bytes. Expected 32 bytes.`
                );
            }

            const privateKey =
                Array.from(privateKeyBytes).join(',');

            console.log('Address:', address);
            console.log(
                'Private key length:',
                privateKey.length
            );

            return {
                address: address,
                privateKey: privateKey,
                mnemonic: mnemonic,
                publicKey: address,
            };
        } catch (error) {
            console.error(
                'Error in generateWallet:',
                error
            );
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    // 니모닉으로 지갑 복구
    async importFromMnemonic(mnemonic) {
        // SDK 초기화
        await this.initSDK();

        try {
            // 니모닉 유효성 검사
            if (!this.suiSDK.validateMnemonic(mnemonic)) {
                throw new Error('Invalid mnemonic');
            }

            // 니모닉으로부터 키페어 복구
            const keypair =
                this.suiSDK.Ed25519Keypair.deriveKeypair(
                    mnemonic
                );

            // 개인키 내보내기 (여러 방법 시도)
            console.log(
                '=== IMPORT FROM MNEMONIC KEYPAIR DEBUG ==='
            );
            console.log('Keypair object:', keypair);
            console.log(
                'Available keypair methods:',
                Object.getOwnPropertyNames(keypair)
            );
            console.log(
                'Available keypair prototype methods:',
                Object.getOwnPropertyNames(
                    Object.getPrototypeOf(keypair)
                )
            );

            let privateKeyBytes;
            if (
                typeof keypair.exportSecretKey ===
                'function'
            ) {
                privateKeyBytes = keypair.exportSecretKey();
                console.log(
                    'Private key exported using exportSecretKey:',
                    privateKeyBytes
                );
            } else if (
                typeof keypair.export === 'function'
            ) {
                const exported = keypair.export();
                console.log(
                    'Keypair export result:',
                    exported
                );
                privateKeyBytes = exported.privateKey;
                console.log(
                    'Private key from export.privateKey:',
                    privateKeyBytes
                );
            } else if (
                typeof keypair.getSecretKey === 'function'
            ) {
                privateKeyBytes = keypair.getSecretKey();
                console.log(
                    'Private key from getSecretKey:',
                    privateKeyBytes
                );
            } else if (keypair.secretKey) {
                privateKeyBytes = keypair.secretKey;
                console.log(
                    'Private key from keypair.secretKey:',
                    privateKeyBytes
                );
            } else if (keypair.privateKey) {
                privateKeyBytes = keypair.privateKey;
                console.log(
                    'Private key from keypair.privateKey:',
                    privateKeyBytes
                );
            } else {
                console.error(
                    'No known method to export private key from keypair'
                );
                throw new Error(
                    'No known method to export private key from keypair'
                );
            }

            // Ed25519 개인키는 32바이트여야 함
            // 만약 64바이트라면 (개인키 + 공개키), 앞의 32바이트만 사용
            if (privateKeyBytes.length === 64) {
                console.log(
                    '64-byte key detected, using first 32 bytes'
                );
                privateKeyBytes = privateKeyBytes.slice(
                    0,
                    32
                );
            } else if (privateKeyBytes.length !== 32) {
                throw new Error(
                    `Invalid private key length: ${privateKeyBytes.length} bytes. Expected 32 bytes.`
                );
            }

            return {
                address: keypair
                    .getPublicKey()
                    .toSuiAddress(),
                privateKey:
                    Array.from(privateKeyBytes).join(','),
                mnemonic: mnemonic,
                publicKey: keypair
                    .getPublicKey()
                    .toSuiAddress(),
            };
        } catch (error) {
            throw new Error(
                error.message ||
                    'Failed to recover from mnemonic'
            );
        }
    }

    // 개인키로 지갑 가져오기
    async importFromPrivateKey(privateKey) {
        // SDK 초기화
        await this.initSDK();

        try {
            // 공통 유틸: CSV "1,2,3,..." -> Uint8Array
            function csvToBytes(csv) {
                const arr = csv
                    .split(',')
                    .map((x) => Number(x.trim()));
                return Uint8Array.from(arr);
            }

            const bytes = csvToBytes(privateKey);
            let keypair;

            // 실제 존재하는 메서드 확인
            const hasFromSeed =
                typeof this.suiSDK.Ed25519Keypair
                    .fromSeed === 'function';
            const hasFromSecretKey =
                typeof this.suiSDK.Ed25519Keypair
                    .fromSecretKey === 'function';

            console.log('Available methods:', {
                hasFromSeed,
                hasFromSecretKey,
            });
            console.log('Key length:', bytes.length);

            if (bytes.length === 32) {
                if (hasFromSeed) {
                    keypair =
                        this.suiSDK.Ed25519Keypair.fromSeed(
                            bytes
                        ); // ✅ 32바이트는 씨드
                    console.log(
                        'Keypair created using fromSeed (import):',
                        keypair
                    );
                } else if (hasFromSecretKey) {
                    // 32바이트를 그대로 전달 (확장하지 않음)
                    keypair =
                        this.suiSDK.Ed25519Keypair.fromSecretKey(
                            bytes
                        );
                    console.log(
                        'Keypair created using fromSecretKey (import):',
                        keypair
                    );
                } else {
                    throw new Error(
                        'No compatible keypair creation method found'
                    );
                }
            } else if (
                bytes.length === 64 &&
                hasFromSecretKey
            ) {
                keypair =
                    this.suiSDK.Ed25519Keypair.fromSecretKey(
                        bytes
                    ); // ✅ 64바이트는 시크릿키
                console.log(
                    'Keypair created using fromSecretKey (64 bytes, import):',
                    keypair
                );
            } else if (bytes.length > 32 && hasFromSeed) {
                // 일부 케이스: 70바이트 같은 확장 포맷이 들어오는 경우 앞 32바이트만 씨드로 사용
                keypair =
                    this.suiSDK.Ed25519Keypair.fromSeed(
                        bytes.slice(0, 32)
                    );
                console.log(
                    'Keypair created using fromSeed (truncated, import):',
                    keypair
                );
            } else {
                throw new Error(
                    `Unsupported private key length: ${bytes.length}. Available methods: fromSeed=${hasFromSeed}, fromSecretKey=${hasFromSecretKey}`
                );
            }

            // 생성된 키페어의 상세 정보 출력 (import)
            console.log('=== IMPORT KEYPAIR DETAILS ===');
            console.log('Keypair type:', typeof keypair);
            console.log(
                'Keypair constructor:',
                keypair.constructor.name
            );
            console.log(
                'Keypair methods:',
                Object.getOwnPropertyNames(keypair)
            );
            console.log(
                'Keypair prototype methods:',
                Object.getOwnPropertyNames(
                    Object.getPrototypeOf(keypair)
                )
            );

            // 공개키 정보
            try {
                const publicKey = keypair.getPublicKey();
                console.log(
                    'Public key (import):',
                    publicKey
                );
                console.log(
                    'Public key type:',
                    typeof publicKey
                );
                console.log(
                    'Public key constructor:',
                    publicKey.constructor.name
                );

                const address = publicKey.toSuiAddress();
                console.log(
                    'Sui address (import):',
                    address
                );
            } catch (error) {
                console.error(
                    'Error getting public key (import):',
                    error
                );
            }

            return {
                address: keypair
                    .getPublicKey()
                    .toSuiAddress(),
                privateKey: privateKey,
                publicKey: keypair
                    .getPublicKey()
                    .toSuiAddress(),
            };
        } catch (error) {
            throw new Error('Invalid private key');
        }
    }

    // 잔액 조회
    async getBalance(address) {
        // SDK 초기화
        await this.initSDK();

        try {
            console.log('=== getBalance called ===');
            console.log('Address:', address);
            console.log(
                'Network endpoint:',
                this.config.network.rpcEndpoint
            );
            console.log(
                'Network name:',
                this.config.network.networkName
            );

            await this.initProvider();

            // 기본 SUI 잔액 확인
            console.log('Getting SUI balance...');

            const balance = await this.client.getBalance({
                owner: address,
                coinType: '0x2::sui::SUI',
            });

            console.log('SUI Balance result:', balance);
            console.log(
                'Total balance:',
                balance.totalBalance
            );
            console.log(
                'Balance type:',
                typeof balance.totalBalance
            );

            // 추가 디버깅: 모든 코인 확인
            try {
                console.log('=== Checking all coins ===');
                const allCoins = await this.client.getCoins(
                    {
                        owner: address,
                    }
                );
                console.log(
                    'All coins found:',
                    allCoins.data.length
                );
                allCoins.data.forEach((coin, index) => {
                    console.log(`Coin ${index}:`, {
                        type: coin.coinType,
                        balance: coin.balance,
                        objectId: coin.coinObjectId,
                    });
                });
            } catch (coinError) {
                console.log(
                    'Failed to get all coins:',
                    coinError.message
                );
            }

            return balance.totalBalance;
        } catch (error) {
            console.error('Failed to get balance:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });

            // 에러 시 0 반환
            return '0';
        }
    }

    // 주소 유효성 검사
    async isValidAddress(address) {
        try {
            await this.initSDK();
            return this.suiSDK.isValidSuiAddress(address);
        } catch (error) {
            return false;
        }
    }

    // Faucet에서 SUI 받기 (테스트넷용)
    async requestFaucet(address) {
        // SDK 초기화
        await this.initSDK();

        try {
            console.log(
                'Requesting SUI from faucet for address:',
                address
            );

            // 메인넷에서는 Faucet이 없으므로 안내
            if (
                this.config.network.networkName ===
                'mainnet'
            ) {
                return {
                    success: false,
                    message:
                        'Mainnet does not have a faucet. You need to purchase SUI from exchanges.',
                    faucetUrl: 'https://suiexplorer.com/',
                };
            }

            // 방법 1: JSON-RPC를 통한 직접 요청 (CORS 우회)
            const response = await fetch(
                'https://fullnode.testnet.sui.io:443',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'sui_requestAddStake',
                        params: [
                            address,
                            [
                                {
                                    coinType:
                                        '0x2::sui::SUI',
                                    amount: 1000000000, // 1 SUI
                                },
                            ],
                        ],
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Faucet request failed: ${response.status} ${response.statusText}`
                );
            }

            const result = await response.json();
            console.log('Faucet response:', result);

            if (result.error) {
                throw new Error(
                    `Faucet error: ${result.error.message}`
                );
            }

            return {
                success: true,
                message:
                    'SUI tokens requested from faucet. Please wait a few minutes for the transaction to be processed.',
                txHash: result.result?.digest || 'Unknown',
            };
        } catch (error) {
            console.error('Faucet request failed:', error);

            // 방법 2: 수동 Faucet 안내
            const faucetUrl =
                this.config.network.networkName ===
                'mainnet'
                    ? 'https://suiexplorer.com/'
                    : `https://suiexplorer.com/faucet?address=${address}`;

            return {
                success: false,
                message: `Faucet API failed. Please visit the Sui Explorer: ${faucetUrl}`,
                faucetUrl: faucetUrl,
            };
        }
    }

    // 블록 번호 조회 (Sui는 epoch 사용)
    async getBlockNumber() {
        try {
            await this.initProvider();
            const epoch = await this.client.getEpochs({
                limit: 1,
                order: 'descending',
            });
            return epoch.data[0]?.epoch || 0;
        } catch (error) {
            console.error('Failed to get epoch:', error);
            return 0;
        }
    }

    // ================================================================
    // 미구현 메서드 (Abstract)
    // ================================================================

    /**
     * 트랜잭션 상태 조회 - 미구현
     * @param {string} txHash - 트랜잭션 해시
     * @returns {Promise<{status: string, confirmations: number}>}
     */
    async getTransactionStatus(txHash) {
        throw new Error(
            'getTransactionStatus() method is not implemented yet.'
        );
    }

    /**
     * 현재 네트워크 수수료 조회 - 미구현
     * @returns {Promise<{low: string, medium: string, high: string}>}
     */
    async getGasPrice() {
        throw new Error(
            'getGasPrice() method is not implemented yet.'
        );
    }

    /**
     * 트랜잭션 수수료 예상 - 미구현
     * @param {Object} txParams - 트랜잭션 파라미터
     * @returns {Promise<string>} - 예상 수수료
     */
    async estimateFee(txParams) {
        throw new Error(
            'estimateFee() method is not implemented yet.'
        );
    }
}

// 어댑터 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SuiAdapter;
} else {
    window.SuiAdapter = SuiAdapter;
}

// ================================================================
// 앱 초기화
// ================================================================

// Sui Adapter 인스턴스 생성 및 등록
const suiAdapter = new SuiAdapter(CoinConfig);
window.setAdapter(suiAdapter);

// 앱 시작 시 호출
if (window.App && window.App.onLaunch) {
    window.App.onLaunch({});
}
