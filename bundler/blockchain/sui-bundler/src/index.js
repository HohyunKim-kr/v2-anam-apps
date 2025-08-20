// Sui SDK 번들링을 위한 엔트리 파일
import { 
  SuiClient
} from '@mysten/sui/client';

import { 
  Ed25519Keypair
} from '@mysten/sui/keypairs/ed25519';

import { 
  TransactionBlock
} from '@mysten/sui.js/transactions';

import { 
  isValidSuiAddress
} from '@mysten/sui/utils';

// 니모닉 관련 라이브러리
import * as bip39 from 'bip39';

// Sui 상수 정의
const SUI_TYPE_ARG = '0x2::sui::SUI';

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

/**
 * 니모닉으로부터 Ed25519 Keypair 파생
 * @param mnemonic BIP-39 니모닉
 * @param accountIndex 기본 0
 */
export function deriveKeypair(mnemonic, accountIndex = 0) {
  // Sui BIP-44 경로: 44'/784'/{accountIndex}'/0'/0'
  const path = `m/44'/784'/${accountIndex}'/0'/0'`;
  return Ed25519Keypair.deriveKeypair(mnemonic, path);
}

/**
 * Keypair에서 개인키(32 bytes) 추출 (Uint8Array → CSV string)
 * SDK 버전에 따라 export() 또는 exportSecretKey()가 존재
 */
export function exportPrivateKey(keypair) {
  let bytes;

  try {
    // 1) getSecretKey() 메서드 사용 (가장 일반적)
    if (typeof keypair.getSecretKey === 'function') {
      const secretKey = keypair.getSecretKey();
      console.log("getSecretKey result:", secretKey);
      
      if (typeof secretKey === 'string') {
        // base64 문자열인 경우 디코딩
        if (secretKey.startsWith('suiprivkey1')) {
          // Sui private key format: suiprivkey1 + base64
          const base64Part = secretKey.replace('suiprivkey1', '');
          const binaryString = atob(base64Part);
          const arr = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            arr[i] = binaryString.charCodeAt(i);
          }
          bytes = arr;
        } else {
          // 일반 base64 문자열
          const binaryString = atob(secretKey);
          const arr = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            arr[i] = binaryString.charCodeAt(i);
          }
          bytes = arr;
        }
      } else if (secretKey instanceof Uint8Array) {
        bytes = secretKey;
      } else if (Array.isArray(secretKey)) {
        bytes = Uint8Array.from(secretKey);
      } else {
        throw new Error(`Unknown secretKey format: ${typeof secretKey}`);
      }
    }
    // 2) export() 메서드 시도
    else if (typeof keypair.export === 'function') {
      const exported = keypair.export();
      console.log("Exported keypair:", exported);
      
      if (exported && exported.privateKey) {
        if (exported.privateKey instanceof Uint8Array) {
          bytes = exported.privateKey;
        } else if (typeof exported.privateKey === 'string') {
          // base64 문자열일 가능성
          const bstr = atob(exported.privateKey);
          const arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
          bytes = arr;
        } else if (Array.isArray(exported.privateKey)) {
          bytes = Uint8Array.from(exported.privateKey);
        } else {
          throw new Error(`Unknown exported privateKey format: ${typeof exported.privateKey}`);
        }
      } else {
        throw new Error("Exported keypair has no privateKey property");
      }
    }
    // 3) exportSecretKey() 메서드 시도
    else if (typeof keypair.exportSecretKey === 'function') {
      const secretKey = keypair.exportSecretKey();
      if (secretKey instanceof Uint8Array) {
        bytes = secretKey;
      } else if (Array.isArray(secretKey)) {
        bytes = Uint8Array.from(secretKey);
      } else {
        throw new Error(`Unknown exportSecretKey format: ${typeof secretKey}`);
      }
    }
    // 4) 직접 속성 접근
    else if (keypair.secretKey) {
      if (keypair.secretKey instanceof Uint8Array) {
        bytes = keypair.secretKey;
      } else if (Array.isArray(keypair.secretKey)) {
        bytes = Uint8Array.from(keypair.secretKey);
      } else {
        throw new Error(`Unknown secretKey property format: ${typeof keypair.secretKey}`);
      }
    }
    else if (keypair.privateKey) {
      if (keypair.privateKey instanceof Uint8Array) {
        bytes = keypair.privateKey;
      } else if (Array.isArray(keypair.privateKey)) {
        bytes = Uint8Array.from(keypair.privateKey);
      } else {
        throw new Error(`Unknown privateKey property format: ${typeof keypair.privateKey}`);
      }
    }
    else {
      throw new Error("No method found to export private key from keypair");
    }

    if (!bytes) {
      throw new Error("Failed to extract bytes from keypair");
    }

    // 32바이트로 제한 (필요한 경우)
    if (bytes.length > 32) {
      bytes = bytes.slice(0, 32);
    }

    if (bytes.length !== 32) {
      throw new Error(`Invalid private key length: ${bytes.length}. Expected 32.`);
    }

    // Uint8Array를 CSV 문자열로 변환
    return Array.from(bytes).join(",");
  } catch (error) {
    console.error("Error in exportPrivateKey:", error);
    throw error;
  }
}

/**
 * 니모닉 생성/검증
 */
export const generateMnemonic = () => bip39.generateMnemonic();
export const validateMnemonic = (mnemonic) => bip39.validateMnemonic(mnemonic);

/**
 * 간단한 SuiClient 생성기 (선택)
 */
export function createClient(rpcUrl) {
  return new SuiClient({ url: rpcUrl });
}

/**
 * 전송 파라미터 유효성 검사
 */
export function validateTransfer(recipient, amount) {
  const errors = [];
  if (!recipient || typeof recipient !== 'string') errors.push('Invalid recipient address');
  if (!isValidSuiAddress(recipient)) errors.push('Invalid Sui address format');
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) errors.push('Invalid amount');
  return { isValid: errors.length === 0, errors };
}

// -------------------------------------------------------------
// Core: SUI 송금 (가스에서 split → transfer → signAndExecute)
// -------------------------------------------------------------
/**
 * SUI 전송 (정석 플로우)
 * @param client SuiClient
 * @param keypair Ed25519Keypair
 * @param recipient 수신자 Sui 주소
 * @param amountSui SUI 단위(예: 0.1)
 */
export async function sendSui(client, keypair, recipient, amountSui) {
  console.log("=== sendSui called ===");
  console.log("Parameters:", { recipient, amountSui });
  
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log("Sender address:", sender);

  // 1 SUI = 10^9 Mist
  const mist = BigInt(Math.floor(Number(amountSui) * 1e9));
  console.log("Amount in MIST:", mist.toString());

  // (선택) 사전 잔액 체크
  console.log("Checking balance...");
  const bal = await client.getBalance({ owner: sender, coinType: SUI_TYPE_ARG });
  console.log("Balance result:", bal);
  console.log("Total balance:", bal.totalBalance);
  
  if (BigInt(bal.totalBalance) < mist) {
    throw new Error(
      `잔액 부족: 보유 ${bal.totalBalance} < 전송 ${mist.toString()} (Mist 단위)`,
    );
  }

  console.log("Balance check passed, creating transaction...");

  const tx = new TransactionBlock();
  tx.setSender(sender);

  // ✅ 가스에서 원하는 금액만 분할
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(mist)]);
  // ✅ 수신자에게 전송
  tx.transferObjects([coin], tx.pure.address(recipient));

  console.log("Transaction created, signing and executing...");

  // ✅ 서명 + 실행 (한 번에)
  const res = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  console.log("Transaction executed successfully:", res);
  return res;
}

// -------------------------------------------------------------
// Sui SDK 객체 생성
// -------------------------------------------------------------
const suiSDK = {
  // SDK
  SuiClient,
  Ed25519Keypair,
  TransactionBlock,
  SUI_TYPE_ARG,
  isValidSuiAddress,
  // Mnemonic
  bip39,
  generateMnemonic,
  validateMnemonic,
  // Helpers
  deriveKeypair,
  exportPrivateKey,
  createClient,
  validateTransfer,
  // Actions
  sendSui,
  // Version tag (수동)
  version: 'bundled-1.0.0',
};

// -------------------------------------------------------------
// Public exports
// -------------------------------------------------------------
export {
  SuiClient,
  Ed25519Keypair,
  TransactionBlock,
  SUI_TYPE_ARG,
  isValidSuiAddress,
  bip39
};

// 기본 내보내기로 suiSDK 제공
export default suiSDK;

// -------------------------------------------------------------
// Global exposure for mini-apps
// -------------------------------------------------------------

// 전역 변수로도 노출 (미니앱에서 사용하기 위해)
if (typeof window !== 'undefined') {
  window.suiSDK = suiSDK;
}

// Node.js 환경에서도 전역으로 노출
if (typeof global !== 'undefined') {
  global.suiSDK = suiSDK;
} 