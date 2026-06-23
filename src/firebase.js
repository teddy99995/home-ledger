import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 1. Firebase 專案設定 4(您的家庭帳本金鑰)
const firebaseConfig = {
  apiKey: "AIzaSyCegdtoILGfQEQqp7hzK5q--if0hViIOF8",
  authDomain: "our-home-ledger-2254a.firebaseapp.com",
  projectId: "our-home-ledger-2254a",
  storageBucket: "our-home-ledger-2254a.firebasestorage.app",
  messagingSenderId: "862648863577",
  appId: "1:862648863577:web:c72fe356874881ce429a48"
};

// 2. 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 3. 匯出 auth (身分驗證) 與 db (資料庫)，讓其他檔案可以使用
export const auth = getAuth(app);
export const db = getFirestore(app);

// 4. 匯出您的 AI 金鑰 (從 .env 讀取，沒有的話會先給空字串)
export const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// 5. 匯出您的專案 ID
export const APP_ID = 'our-home-ledger-2254a';
