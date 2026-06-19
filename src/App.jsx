import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, X, Trash2, Sparkles, ChevronLeft, ChevronRight, Target, Coins, 
  PieChart as PieChartIcon, ArrowRightLeft, Home, Search, Settings, CheckCircle2, AlertTriangle,
  Barcode, Camera, ClipboardList, StickyNote, Edit3, CalendarHeart, Mic, MicOff,
  Wallet, CalendarClock, Check, ShoppingCart, DownloadCloud, ChevronDown, ChevronUp, Moon, Sun, Filter, Wand2, Bell, Repeat, Loader2, Save, Plane
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, 
  deleteDoc, updateDoc, setDoc, arrayUnion
} from 'firebase/firestore';

// ==========================================
// 1. 核心設定與資料庫初始化
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyCegdtoILGfQEQqp7hzK5q--if0hViIOF8",
  authDomain: "our-home-ledger-2254a.firebaseapp.com",
  projectId: "our-home-ledger-2254a",
  storageBucket: "our-home-ledger-2254a.firebasestorage.app",
  messagingSenderId: "862648863577",
  appId: "1:862648863577:web:c72fe356874881ce429a48"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🤖 您的專屬 Gemini API 金鑰
const apiKey = "AQ.Ab8RN6I_s9Pirhsp49ETH61MshhYI9d-7YEoNAaBlrRTIs6C8A"; 

// 分類設定
const CATEGORIES = {
  expense: [
    { name: '餐飲', icon: '🍽️' }, { name: '購物', icon: '🛍️' }, { name: '交通', icon: '🚗' }, 
    { name: '居家', icon: '🏠' }, { name: '娛樂', icon: '🍿' }, { name: '醫療', icon: '💊' }, 
    { name: '教育', icon: '📚' }, { name: '其他', icon: '✨' }
  ],
  income: [ { name: '薪資', icon: '💰' }, { name: '投資', icon: '📈' }, { name: '獎金', icon: '🎁' }, { name: '其他', icon: '✨' } ]
};

const getLocalYYYYMM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const getLocalYYYYMMDD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const calculateDaysDiff = (target) => Math.ceil((new Date(target).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);

// 🔥 智慧資料庫路徑設計
const isCanvas = typeof __app_id !== 'undefined';
const safeAppId = isCanvas ? String(__app_id) : ''; 

const getCol = (colName) => {
  return isCanvas 
    ? collection(db, 'artifacts', safeAppId, 'public', 'data', String(colName))
    : collection(db, String(colName)); 
};

const getDocRef = (colName, docId) => {
  if (!docId) throw new Error("無效的資料 ID");
  return isCanvas
    ? doc(db, 'artifacts', safeAppId, 'public', 'data', String(colName), String(docId))
    : doc(db, String(colName), String(docId)); 
};

// ==========================================
// 🛡️ API 防護網 
// ==========================================
const fetchWithBackoff = async (url, options, retries = 3) => {
  const delays = [1000, 2000, 4000];
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP error! status: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
};

// ==========================================
// 🎨 UI 元件：高質感 Switch 切換開關
// ==========================================
const ToggleSwitch = ({ checked, onChange, isDark }) => (
  <div 
    onClick={() => onChange(!checked)} 
    className={`w-14 h-8 rounded-full cursor-pointer relative transition-colors duration-300 ease-in-out ${checked ? (isDark ? 'bg-indigo-600' : 'bg-[#5C4033]') : (isDark ? 'bg-slate-700' : 'bg-stone-300')}`}
  >
    <div className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </div>
);

// ==========================================
// 2. 主程式 App Component
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ 
    tx: [], accounts: [], bills: [], notes: [], shopping: [], goals: [], events: [], tags: [], recurringRules: [], templates: [] 
  });
  
  const [settings, setSettings] = useState({ 
    monthlyBudget: 50000, husbandBarcode: '', wifeBarcode: '',
    enableRollover: true, notifyLargeExpense: true, largeExpenseThreshold: 3000, 
    notifyBillDue: true, notifyEvents: true, notifyAdvanceDays: 3,
    travelMode: false, travelCurrency: 'JPY', travelRate: 0.21
  });
  
  const [ui, setUi] = useState({ 
    date: new Date(), tab: 'home', subTab: 'bills', statsView: 'month', modal: null, search: '', filterTags: [], 
    isDark: true, confirm: null, selectedItem: null, toast: null, selectedTx: null 
  });
  
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const processedRecurring = useRef(false);

  const updateUi = (updates) => setUi(prev => ({ ...prev, ...updates }));
  const showToast = (msg, type = 'success') => { 
    updateUi({ toast: { msg, type } }); 
    setTimeout(() => updateUi({ toast: null }), 4000); 
  };

  useEffect(() => {
    const isLineApp = navigator.userAgent.includes("Line") || navigator.userAgent.includes("LINE");
    const currentUrl = window.location.href;
    if (isLineApp && !currentUrl.includes("openExternalBrowser=1")) {
      const separator = currentUrl.includes("?") ? "&" : "?";
      window.location.replace(currentUrl + separator + "openExternalBrowser=1");
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        showToast("登入失敗，請檢查網路", "error");
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(getCol('shared_accounts'), snap => {
        if (snap.empty) {
          const defaults = [{ id: 'acc_joint', name: '共同帳戶', type: 'joint', icon: '🏦' }, { id: 'acc_h', name: '老公帳戶', type: 'husband', icon: '👨' }, { id: 'acc_w', name: '老婆帳戶', type: 'wife', icon: '👩' }];
          defaults.forEach(d => setDoc(getDocRef('shared_accounts', d.id), { ...d, createdAt: serverTimestamp() }));
        } else {
          setData(prev => ({ ...prev, accounts: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()) }));
        }
      }),
      onSnapshot(getDocRef('shared_settings', 'main'), doc => { if (doc.exists()) setSettings(prev => ({ ...prev, ...doc.data() })); }),
      onSnapshot(getDocRef('shared_tags', 'main'), doc => setData(prev => ({ ...prev, tags: doc.exists() ? doc.data().tags : [] }))),
      onSnapshot(getCol('recurring_rules'), snap => setData(prev => ({ ...prev, recurringRules: snap.docs.map(d => ({ id: d.id, ...d.data() })) }))),
      onSnapshot(getCol('shared_templates'), snap => setData(prev => ({ ...prev, templates: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()) }))),
      onSnapshot(getCol('shared_ledger'), snap => setData(p => ({ ...p, tx: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()) }))),
      onSnapshot(getCol('shared_bills'), snap => setData(p => ({ ...p, bills: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.dueDate - b.dueDate) }))),
      onSnapshot(getCol('shared_notes'), snap => setData(p => ({ ...p, notes: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis()) }))),
      onSnapshot(getCol('shared_shopping'), snap => setData(p => ({ ...p, shopping: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.completed === b.completed ? (b.createdAt?.toMillis() - a.createdAt?.toMillis()) : (a.completed ? 1 : -1)) }))),
      onSnapshot(getCol('shared_goals'), snap => setData(p => ({ ...p, goals: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()) }))),
      onSnapshot(getCol('shared_events'), snap => setData(p => ({ ...p, events: snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => calculateDaysDiff(a.date) - calculateDaysDiff(b.date)) })))
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  // 週期性記帳引擎
  useEffect(() => {
    if (!user || data.recurringRules.length === 0 || processedRecurring.current) return;
    const processRules = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let processedCount = 0;
      for (const rule of data.recurringRules) {
        if (!rule.nextDueDate) continue;
        const dueDate = rule.nextDueDate.toDate(); dueDate.setHours(0, 0, 0, 0);
        if (dueDate <= today) {
          const newTx = { ...rule.txData, date: getLocalYYYYMMDD(dueDate), month: getLocalYYYYMM(dueDate), createdAt: serverTimestamp(), createdBy: user.uid, tags: [...(rule.txData.tags || []), '週期性'] };
          await addDoc(getCol('shared_ledger'), newTx);
          const next = new Date(dueDate);
          if (rule.frequency === 'monthly') next.setMonth(next.getMonth() + rule.interval);
          else if (rule.frequency === 'weekly') next.setDate(next.getDate() + rule.interval * 7);
          await updateDoc(getDocRef('recurring_rules', rule.id), { nextDueDate: next });
          processedCount++;
        }
      }
      if (processedCount > 0) showToast(`已自動建立 ${processedCount} 筆週期性記帳！`);
      processedRecurring.current = true;
    };
    processRules();
  }, [user, data.recurringRules]);

  const cMonth = getLocalYYYYMM(ui.date);
  const cYear = String(ui.date.getFullYear());
  const mTx = useMemo(() => data.tx.filter(t => t.month === cMonth), [data.tx, cMonth]);
  const yTx = useMemo(() => data.tx.filter(t => t.date.startsWith(cYear)), [data.tx, cYear]);
  
  const displayTx = useMemo(() => mTx.filter(t => {
    const q = !ui.search || t.category?.includes(ui.search) || t.note?.includes(ui.search);
    const tg = ui.filterTags.length === 0 || ui.filterTags.every(tag => t.tags && t.tags.includes(tag));
    return q && tg;
  }), [mTx, ui.search, ui.filterTags]);

  const calcStats = (txs) => txs.reduce((s, t) => {
    if (t.type === 'transfer') return s;
    if (t.type === 'expense') {
      s.exp += t.amount; s.cat[t.category] = (s.cat[t.category] || 0) + t.amount;
      if (t.payer === 'husband') s.hp += t.amount; if (t.payer === 'wife') s.wp += t.amount;
      if (t.split === 'husband') s.ho += t.amount; else if (t.split === 'wife') s.wo += t.amount; else { s.ho += t.amount / 2; s.wo += t.amount / 2; }
    } else if (t.type === 'income') { s.inc += t.amount; }
    return s;
  }, { exp: 0, inc: 0, cat: {}, ho: 0, wo: 0, hp: 0, wp: 0 });

  const hStats = calcStats(mTx);
  const tStats = calcStats(ui.statsView === 'month' ? mTx : yTx);

  const rollover = useMemo(() => {
    if (!settings.enableRollover) return { enabled: false, amt: 0, budget: settings.monthlyBudget };
    const pMonth = getLocalYYYYMM(new Date(ui.date.getFullYear(), ui.date.getMonth() - 1, 1));
    const pExp = data.tx.filter(t => t.month === pMonth && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const amt = (pExp < settings.monthlyBudget && pExp > 0) ? settings.monthlyBudget - pExp : 0;
    return { enabled: true, amt, budget: settings.monthlyBudget + amt };
  }, [settings, ui.date, data.tx]);

  const accBal = data.accounts.reduce((acc, a) => {
    const balance = data.tx.reduce((sum, t) => {
      if (t.type === 'transfer') {
        if (t.fromAccountId === a.id) return sum - t.amount;
        if (t.toAccountId === a.id) return sum + t.amount;
      } else if (t.accountId === a.id) {
        return t.type === 'expense' ? sum - t.amount : sum + t.amount;
      }
      return sum;
    }, a.balance || 0);
    return { ...acc, [a.id]: balance };
  }, {});
  const totalAssets = Object.values(accBal).reduce((s, b) => s + b, 0);

  // 🌟 修正後的完美結算邏輯
  const settlement = useMemo(() => {
    // 老公付的錢 (hp) 減去 老公該付的錢 (ho)
    const hDiff = tStats.hp - tStats.ho; 
    
    // 如果 hDiff > 0，代表老公墊得多，老婆該給老公
    if (hDiff > 0.01) return { who: 'wife', to: 'husband', amt: hDiff };
    
    // 如果 hDiff < 0，代表老婆墊得多 (老公欠錢)，老公該給老婆
    if (hDiff < -0.01) return { who: 'husband', to: 'wife', amt: Math.abs(hDiff) };
    
    return { status: 'settled' };
  }, [tStats]);

  // 🔔 系統通知
  const rawAlerts = useMemo(() => {
    const a = []; const today = new Date().getDate(); const notifyDays = settings.notifyAdvanceDays || 3;
    if (settings.notifyBillDue) data.bills.forEach(b => { if (!b.isPaid && b.dueDate - today >= 0 && b.dueDate - today <= notifyDays) a.push({ id: `b_${b.id}`, icon: b.icon || '🧾', title: '帳單到期', desc: `${b.name} 將在 ${b.dueDate - today === 0 ? '今天' : `${b.dueDate - today} 天後`} 到期` }); });
    if (settings.notifyEvents) data.events.forEach(e => { const d = calculateDaysDiff(e.date); if (d >= 0 && d <= notifyDays) a.push({ id: `e_${e.id}`, icon: e.icon || '🎉', title: '紀念日提醒', desc: `${e.title} 還有 ${d} 天` }); });
    if (settings.notifyLargeExpense) data.tx.slice(0, 15).forEach(t => { if (t.type === 'expense' && t.amount >= (settings.largeExpenseThreshold || 3000)) a.push({ id: `t_${t.id}`, icon: '💸', title: '大額消費防護', desc: `${t.payer === 'husband' ? '老公' : t.payer === 'wife' ? '老婆' : '共同'} 記了一筆 $${t.amount.toLocaleString()}` }); });
    return a;
  }, [data, settings]);

  const activeAlerts = rawAlerts.filter(a => !dismissedAlerts.includes(a.id));

  const pieChartData = useMemo(() => {
    const total = tStats.exp || 1;
    return Object.entries(tStats.cat).map(([name, value]) => {
      const icon = CATEGORIES.expense.find(c => c.name === name)?.icon || '✨';
      return { name, value, percentage: Math.round((value / total) * 100), color: '#b45309', icon };
    }).sort((a, b) => b.value - a.value);
  }, [tStats]);

  // ==========================================
  // 🛡️ Firebase 操作防護網
  // ==========================================
  const doAction = async (action, successMsg) => {
    try { 
      await action(); 
      if (successMsg) showToast(successMsg); 
    } catch (e) { 
      console.error("Firebase 執行錯誤:", e);
      if (e.message?.includes('undefined') || e.message?.includes('indexOf')) {
         showToast("操作失敗：找不到該筆資料", "error"); 
      } else if (e.code === 'permission-denied') {
         showToast("權限不足：請檢查 Firebase 資料庫的 Rules", "error");
      } else {
         showToast(`操作失敗: ${e.message}`, "error"); 
      }
    } finally {
      updateUi({ modal: null, confirm: null, selectedTx: null }); 
    }
  };
  
  const confirmDel = (msg, action) => updateUi({ 
    confirm: { message: msg, onConfirm: () => doAction(action, "已成功刪除") } 
  });

  const handleAddGlobalTag = async (tagName) => {
    if (!tagName.trim() || data.tags.includes(tagName)) return;
    try { await setDoc(getDocRef('shared_tags', 'main'), { tags: arrayUnion(tagName) }, { merge: true }); showToast(`標籤 #${tagName} 已建立`); } catch (err) {}
  };

  // 🤖 AI 顧問呼叫
  const handleCallAI = async () => {
    if (!apiKey || apiKey.includes("請在此貼上")) {
      showToast("系統未設定 API 金鑰！", "error");
      return;
    }
    setIsAiLoading(true); setAiAnalysis('');
    try {
      const topCats = pieChartData.slice(0, 3).map(c => `${c.name}(${c.percentage}%)`).join('、');
      let stext = settlement.status === 'settled' ? "無欠款" : (settlement.who === 'husband' ? `老公需給老婆${Math.round(settlement.amt)}` : `老婆需給老公${Math.round(settlement.amt)}`);
      const prompt = `這是家庭帳本本月紀錄：支出${tStats.exp}元。前三花費:${topCats || '無'}。結算:${stext}。請用溫馨朋友語氣給一段50字理財建議(不列點)。`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      };

      const resData = await fetchWithBackoff(url, options);
      
      if (!resData || !resData.candidates) throw new Error("API 回傳異常");
      setAiAnalysis(resData.candidates[0].content.parts[0].text);
    } catch (err) { 
      setAiAnalysis(`AI 服務連線異常：${err.message}`); 
      console.error(err);
    } finally { 
      setIsAiLoading(false); 
    }
  };

  // 匯出 CSV 
  const handleExportToSheets = () => {
    if (data.tx.length === 0) return showToast("目前沒有資料可以匯出喔！", "error"); 
    const BOM = "\uFEFF"; 
    const headers = ['日期', '類型', '分類/轉出', '帳戶/轉入', '金額', '備註', '付款人', '標籤'];
    const rows = data.tx.map(tx => {
      const typeLabel = tx.type === 'expense' ? '支出' : tx.type === 'income' ? '收入' : '轉帳';
      const catOrFrom = tx.type === 'transfer' ? data.accounts.find(a => a.id === tx.fromAccountId)?.name : tx.category;
      const accOrTo = tx.type === 'transfer' ? data.accounts.find(a => a.id === tx.toAccountId)?.name : data.accounts.find(a => a.id === tx.accountId)?.name;
      const payerLabel = tx.payer === 'husband' ? '老公' : tx.payer === 'wife' ? '老婆' : '共同';
      return [tx.date, typeLabel, catOrFrom || '', accOrTo || '', tx.amount, `"${tx.note || ''}"`, payerLabel, tx.tags ? `"${tx.tags.join(';')}"` : ''].join(",");
    });
    
    const csvContent = BOM + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); 
    const link = document.createElement('a'); 
    link.href = url; link.setAttribute('download', `HomeLedger_${getLocalYYYYMMDD(new Date())}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link); 
    showToast("匯出成功！請直接匯入 Google Sheets");
  };

  // ==========================================
  // 🌞 🌙 日夜與旅遊雙生主題引擎 
  // ==========================================
  let t = ui.isDark ? { 
    bg: 'bg-[#0F172A]', 
    cardInner: 'bg-[#1E293B]', 
    text: 'text-[#F8FAFC]', 
    textM: 'text-[#94A3B8]', 
    primary: 'bg-[#4F46E5]', 
    primaryText: 'text-[#818CF8]', 
    border: 'border-[#334155]', 
    input: 'bg-[#0F172A] text-white',
    ring: 'focus:ring-indigo-500'
  } : {
    bg: 'bg-[#FAF9F6]', 
    cardInner: 'bg-white', 
    text: 'text-[#2A2623]', 
    textM: 'text-[#8C857D]', 
    primary: 'bg-[#5C4033]', 
    primaryText: 'text-[#5C4033]', 
    border: 'border-[#EAE4DD]', 
    input: 'bg-[#FAF9F6] text-[#2A2623]',
    ring: 'focus:ring-[#C86D23]'
  };

  if (settings.travelMode) {
     t = {
       ...t,
       bg: ui.isDark ? 'bg-[#001f3f]' : 'bg-[#e0f7fa]',
       primary: ui.isDark ? 'bg-[#0074D9]' : 'bg-[#0074D9]',
       primaryText: ui.isDark ? 'text-[#7FDBFF]' : 'text-[#0074D9]'
     }
  }

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{__html: `
        .pb-safe { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom)); }
        .pt-safe { padding-top: calc(1rem + env(safe-area-inset-top)); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        body { background-color: ${settings.travelMode ? (ui.isDark ? '#001f3f' : '#e0f7fa') : (ui.isDark ? '#0F172A' : '#FAF9F6')}; margin: 0; padding: 0; transition: background-color 0.5s ease; }
        .donut-ring { stroke-dasharray: 251.2; stroke-dashoffset: 0; transition: stroke-dashoffset 1s ease-in-out; }
      `}} />

      <div className={`min-h-[100dvh] w-full flex justify-center ${t.bg} transition-colors duration-500 overflow-x-hidden font-sans`}>
        <div className={`w-full max-w-md md:max-w-xl ${t.text} relative flex flex-col min-h-[100dvh] ${t.cardInner} md:border-x md:shadow-2xl ${t.border}`}>
          
          {/* 🔥 刪除確認 Modal (設定 z-[9999] 保證絕對在最上層) */}
          {ui.confirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className={`${t.cardInner} rounded-3xl p-8 w-full max-w-xs shadow-2xl text-center border ${t.border}`}>
                <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-6 bg-red-500/10 p-4 rounded-full" />
                <h3 className={`text-2xl font-black ${t.text} mb-8`}>{ui.confirm.message}</h3>
                <div className="flex gap-4">
                  <button onClick={() => updateUi({confirm: null})} className={`flex-1 py-5 rounded-2xl font-bold text-lg ${t.textM} ${t.bg} active:scale-95`}>取消</button>
                  <button onClick={ui.confirm.onConfirm} className="flex-1 py-5 rounded-2xl font-bold text-lg text-white bg-red-500 shadow-md active:scale-95">刪除</button>
                </div>
              </div>
            </div>
          )}

          {/* Toast 提示 */}
          {ui.toast && (
            <div className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-4 animate-in slide-in-from-top-4 pointer-events-none">
              <div className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl border ${t.cardInner} ${t.border} ${t.text}`}>
                <CheckCircle2 className={`w-6 h-6 ${ui.toast.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`} />
                <span className="font-bold text-lg truncate max-w-xs">{ui.toast.msg}</span>
              </div>
            </div>
          )}

          {/* 🌟 頂部 Header */}
          <header className={`px-6 pt-safe pb-4 flex justify-between items-center ${t.cardInner} z-10 shrink-0`}>
            <div className="flex gap-3 w-24">
               <button onClick={() => updateUi({ isDark: !ui.isDark })} className={`p-3 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}>
                 {ui.isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
               </button>
               <button onClick={() => updateUi({ modal: 'settings' })} className={`p-3 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}>
                 <Settings className="w-5 h-5"/>
               </button>
            </div>
            
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-black tracking-wide flex items-center justify-center gap-1.5">
                {settings.travelMode && <Plane className="w-6 h-6 text-[#0074D9]" />} 
                Home Ledger 
                {!settings.travelMode && <span className="text-rose-500">♡</span>}
              </h1>
            </div>

            <div className="flex gap-3 w-24 justify-end relative">
              <button onClick={() => updateUi({ modal: 'barcode' })} className={`p-3 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform`}>
                <Barcode className="w-5 h-5"/>
              </button>
              <button onClick={() => updateUi({ modal: 'notify' })} className={`p-3 rounded-full border ${t.border} ${t.bg} active:scale-95 transition-transform relative`}>
                <Bell className="w-5 h-5"/>
                {activeAlerts.length > 0 && <span className={`absolute top-2 right-2 w-4 h-4 bg-red-500 border-2 ${ui.isDark ? 'border-[#1E293B]' : 'border-white'} rounded-full`}></span>}
              </button>
            </div>
          </header>

          {/* 主畫面 */}
          <main className={`px-6 space-y-8 flex-1 overflow-y-auto pb-40 pt-2 hide-scrollbar ${t.bg}`}>
            
            {/* ================= 首頁 Tab ================= */}
            {ui.tab === 'home' && (
              <div className="space-y-8 animate-in fade-in">
                <section className={`${t.cardInner} rounded-[2.5rem] p-8 shadow-sm border ${t.border}`}>
                  <div className="flex justify-between items-center mb-6">
                     <button onClick={() => updateUi({ modal: 'date' })} className={`flex items-center gap-2 font-bold text-xl ${t.text} ${t.bg} px-5 py-3 rounded-xl border ${t.border} active:scale-95`}>
                       {ui.date.getFullYear()}年{ui.date.getMonth() + 1}月 <ChevronDown className="w-6 h-6" />
                     </button>
                     <span className={`font-bold text-xl ${t.textM}`}>總支出</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className={`text-6xl font-bold ${t.primaryText}`}>$</span>
                    <h2 className="text-[6rem] leading-none font-black tracking-tighter">{hStats.exp.toLocaleString()}</h2>
                  </div>
                  
                  {rollover.enabled && !settings.travelMode && (
                    <div className={`mt-8 pt-6 border-t ${t.border}`}>
                       <div className="flex items-center gap-2 mb-4">
                         <Sparkles className={`w-6 h-6 text-rose-500`} />
                         <span className={`text-base font-bold ${t.text}`}>上月預算結轉機制</span>
                       </div>
                       <div className="flex justify-between items-center mb-4">
                         <span className={`text-base font-bold ${t.textM}`}>上月省下：<strong className="text-emerald-500">${rollover.amt.toLocaleString()}</strong></span>
                         <span className={`text-base font-bold ${t.textM}`}>本月可用：<strong className={t.text}>${rollover.budget.toLocaleString()}</strong></span>
                       </div>
                       <div className={`w-full h-3 ${t.bg} rounded-full overflow-hidden`}>
                         <div className={`h-full ${t.primary} rounded-full transition-all duration-1000 ease-out`} style={{width: `${Math.min((hStats.exp/rollover.budget)*100, 100)}%`}}></div>
                       </div>
                    </div>
                  )}
                </section>

                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className={`w-7 h-7 ${t.textM} absolute left-5 top-1/2 -translate-y-1/2`} />
                    <input type="text" value={ui.search} onChange={e => updateUi({ search: e.target.value })} placeholder="搜尋明細、備註..." className={`w-full ${t.cardInner} font-bold py-5 pl-16 pr-5 text-xl rounded-2xl border ${t.border} focus:outline-none focus:ring-2 ${t.ring} transition-colors`} />
                  </div>
                  <button onClick={() => updateUi({ modal: 'tags' })} className={`p-5 rounded-2xl border ${ui.filterTags.length > 0 ? `${t.primary} text-white border-transparent shadow-md` : `${t.cardInner} ${t.textM} ${t.border}`} active:scale-95 transition-all`}>
                    <Filter className="w-7 h-7" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-3xl font-black">最近明細</h3>
                    <div className="flex gap-2">
                      <button className={`p-3 rounded-full ${t.cardInner} border ${t.border} active:scale-95`}><ChevronLeft className={`w-6 h-6 ${t.textM}`}/></button>
                      <button className={`p-3 rounded-full ${t.cardInner} border ${t.border} active:scale-95`}><ChevronRight className={`w-6 h-6 ${t.textM}`}/></button>
                    </div>
                  </div>
                  
                  {displayTx.length === 0 ? (
                    <div className={`text-center py-20 font-bold text-xl ${t.textM} ${t.cardInner} rounded-3xl border ${t.border}`}>本月還沒有記帳紀錄</div>
                  ) : displayTx.map(tx => (
                    <div key={tx.id} className={`p-6 rounded-3xl flex flex-col border ${t.border} ${t.cardInner} shadow-sm group`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5 truncate">
                          <div className={`w-20 h-20 rounded-full ${t.bg} flex items-center justify-center text-4xl shrink-0`}>
                            {tx.type === 'transfer' ? <ArrowRightLeft className="w-8 h-8 text-stone-500" /> : CATEGORIES.expense.find(c=>c.name===tx.category)?.icon || CATEGORIES.income.find(c=>c.name===tx.category)?.icon || '📝'}
                          </div>
                          <div className="truncate">
                            <p className="font-extrabold text-2xl truncate mb-2">
                              {tx.type === 'transfer' ? '轉帳' : tx.category} 
                              <span className={`text-base ${t.textM} ml-3 font-normal`}>
                                {tx.type === 'transfer' ? 
                                  `${data.accounts.find(a=>a.id===tx.fromAccountId)?.name} ➔ ${data.accounts.find(a=>a.id===tx.toAccountId)?.name}` 
                                  : `(${data.accounts.find(a=>a.id===tx.accountId)?.name})`}
                              </span>
                            </p>
                            <div className="flex gap-2 mt-2 flex-wrap items-center">
                              {tx.type !== 'transfer' && (
                                <span className={`text-sm px-3 py-1.5 rounded-lg font-bold ${t.bg} ${t.textM}`}>
                                  付:{tx.payer==='husband'?'老公':tx.payer==='wife'?'老婆':'共同'}
                                </span>
                              )}
                              {tx.tags?.map(tg => <span key={tg} className={`text-sm font-bold ${t.primaryText}`}>#{tg}</span>)}
                              <span className={`text-base ${t.textM} font-bold truncate max-w-[200px] ml-2`}>{tx.note}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`font-black text-3xl ${tx.type === 'expense' ? t.text : tx.type === 'income' ? 'text-emerald-500' : t.textM}`}>
                            {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}${tx.amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className={`flex justify-end gap-3 mt-5 pt-5 border-t ${t.border}`}>
                        <button onClick={() => updateUi({ modal: 'tx', selectedTx: tx })} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold ${t.bg} ${t.textM} hover:${t.primaryText} active:scale-95 transition-colors`}>
                          <Edit3 className="w-5 h-5" /> 修改
                        </button>
                        <button onClick={() => confirmDel('確定要刪除這筆紀錄嗎？', () => deleteDoc(getDocRef('shared_ledger', tx.id)))} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold ${ui.isDark ? 'bg-red-900/20' : 'bg-red-50'} text-red-500 active:scale-95 transition-colors`}>
                          <Trash2 className="w-5 h-5" /> 刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* ================= 帳戶 Tab ================= */}
            {ui.tab === 'wallets' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-3xl font-black">總資產</h2>
                  <span className={`text-4xl font-black ${t.primaryText}`}>${totalAssets.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {data.accounts.map(a => (
                    <div key={a.id} className={`p-6 rounded-3xl ${t.cardInner} shadow-sm border ${t.border} relative group`}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-4xl">{a.icon}</span>
                        <span className="font-bold text-xl truncate">{a.name}</span>
                      </div>
                      <div className="text-3xl font-black">${(accBal[a.id] || 0).toLocaleString()}</div>
                      <Trash2 onClick={() => confirmDel('刪除帳戶？', () => deleteDoc(getDocRef('shared_accounts', a.id)))} className={`w-6 h-6 ${t.textM} absolute top-6 right-6 cursor-pointer hover:text-red-500`} />
                    </div>
                  ))}
                  <div onClick={() => updateUi({ modal: 'account' })} className={`bg-transparent border-2 border-dashed ${t.border} rounded-3xl p-6 flex flex-col items-center justify-center ${t.textM} cursor-pointer min-h-[160px] hover:border-[#D97706] transition-colors active:scale-95`}>
                    <Plus className="w-12 h-12 mb-3"/>
                    <span className="text-xl font-bold">新增帳戶</span>
                  </div>
                </div>
              </div>
            )}

            {/* ================= 統計 Tab ================= */}
            {ui.tab === 'stats' && (
              <div className="space-y-6 animate-in fade-in">
                 <div className={`flex ${t.cardInner} p-2 rounded-2xl border ${t.border} shadow-sm`}>
                   <button onClick={() => updateUi({ statsView: 'month' })} className={`flex-1 py-4 rounded-xl text-base font-bold ${ui.statsView === 'month' ? `${t.bg} ${t.text} shadow-sm` : t.textM}`}>當月分析</button>
                   <button onClick={() => updateUi({ statsView: 'year' })} className={`flex-1 py-4 rounded-xl text-base font-bold ${ui.statsView === 'year' ? `${t.bg} ${t.text} shadow-sm` : t.textM}`}>年度總結</button>
                 </div>
                 
                 <div className="flex justify-between items-center px-2 pt-2">
                   <button onClick={() => updateUi({ modal: 'date' })} className={`flex items-center gap-2 font-bold text-xl ${t.cardInner} px-6 py-3 rounded-2xl shadow-sm border ${t.border} active:scale-95`}>
                     {ui.date.getFullYear()}年{ui.date.getMonth() + 1}月 <ChevronDown className="w-6 h-6 ml-1" />
                   </button>
                   <span className="text-5xl font-black">${tStats.exp.toLocaleString()}</span>
                 </div>

                 <div className={`${t.cardInner} rounded-[2.5rem] p-8 border ${t.border} shadow-sm`}>
                  <h3 className="font-extrabold text-2xl mb-8 flex items-center gap-3"><ArrowRightLeft className="w-8 h-8"/> 本月代墊結算</h3>
                  {settlement.status === 'settled' ? (
                    <div className={`p-6 text-center font-bold text-emerald-500 bg-emerald-500/10 rounded-3xl text-xl flex items-center justify-center gap-3`}>🎉 帳目完全算清！</div>
                  ) : (
                    <div className={`flex items-center justify-between ${t.bg} rounded-3xl p-6 border ${t.border}`}>
                      {/* 🌟 永遠固定：左老婆、右老公 */}
                      <div className="flex flex-col items-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-4xl bg-[#FEF0C7]`}>👩</div>
                        <span className={`text-sm font-bold mt-3 ${t.textM}`}>老婆</span>
                      </div>
                      
                      <div className="flex flex-col items-center flex-1 px-2 relative">
                        <span className={`text-sm ${t.textM} font-bold mb-3`}>應給付</span>
                        <div className="flex items-center justify-center w-full text-rose-500">
                          {/* 如果老婆付的多，老公該還老婆，箭頭向左 */}
                          {settlement.who === 'husband' && <ChevronLeft className="w-8 h-8 mr-1" strokeWidth={3} />}
                          <span className="text-4xl font-black mx-2">${Math.round(settlement.amt).toLocaleString()}</span>
                          {/* 如果老公付的多，老婆該還老公，箭頭向右 */}
                          {settlement.who === 'wife' && <ChevronRight className="w-8 h-8 ml-1" strokeWidth={3} />}
                        </div>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-4xl bg-[#EAE0D5]`}>👨</div>
                        <span className={`text-sm font-bold mt-3 ${t.textM}`}>老公</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={`${t.cardInner} rounded-[2.5rem] p-8 border ${t.border} shadow-sm flex flex-col items-center`}>
                  <div className="relative w-64 h-64 flex items-center justify-center mb-10">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke={ui.isDark ? "#334155" : "#EAE4DD"} strokeWidth="12" />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke={ui.isDark ? "#4F46E5" : "#C86D23"} strokeWidth="12" className="donut-ring" strokeDashoffset={tStats.exp > 0 ? 0 : 251.2} />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className={`text-sm font-bold ${t.textM}`}>總支出</span>
                      <span className="text-4xl font-black mt-2">${tStats.exp.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full space-y-4">
                    {pieChartData.length === 0 ? <div className={`text-center text-base font-bold ${t.textM}`}>無支出資料</div> : pieChartData.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-5 rounded-2xl ${t.bg}`}>
                        <div className="flex gap-4 font-bold text-xl items-center">{item.icon} {item.name}</div>
                        <div className="font-black text-xl">{item.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${t.cardInner} rounded-[2.5rem] p-8 border ${t.border}`}>
                  <button onClick={handleCallAI} disabled={isAiLoading} className={`w-full ${t.primary} text-white py-6 rounded-3xl font-bold text-xl flex justify-center items-center gap-3 active:scale-95 shadow-md disabled:opacity-50`}>
                    {isAiLoading ? <Loader2 className="animate-spin w-7 h-7"/> : <Sparkles className="w-7 h-7"/>} 產生理財顧問分析
                  </button>
                  {aiAnalysis && <p className={`mt-6 p-6 ${t.bg} rounded-3xl text-lg font-bold leading-relaxed border ${t.border}`}>{aiAnalysis}</p>}
                </div>
              </div>
            )}

            {/* ================= 生活 Tab ================= */}
            {ui.tab === 'life' && (
              <div className="space-y-6 animate-in fade-in">
                <div className={`flex ${t.cardInner} p-2 rounded-2xl border ${t.border} shadow-sm overflow-x-auto hide-scrollbar`}>
                  {[
                    { id: 'bills', label: '帳單', icon: <CalendarClock className="w-6 h-6"/> }, 
                    { id: 'shopping', label: '購物', icon: <ShoppingCart className="w-6 h-6"/> }, 
                    { id: 'notes', label: '記事', icon: <StickyNote className="w-6 h-6"/> }, 
                    { id: 'events', label: '日子', icon: <CalendarHeart className="w-6 h-6"/> },
                    { id: 'goals', label: '夢想', icon: <Target className="w-6 h-6"/> }
                  ].map(item => (
                    <button key={item.id} onClick={() => updateUi({ subTab: item.id })} className={`flex-1 min-w-[80px] py-4 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-2 transition-all ${ui.subTab === item.id ? `${t.bg} ${t.text} shadow-sm` : t.textM}`}>
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
                
                {/* 內部列表項目字體全面放大 */}
                {ui.subTab === 'bills' && (
                  <div className="space-y-5">
                    <div className="flex justify-between items-center mb-8 px-2">
                      <div>
                        <h3 className="text-2xl font-black">每月固定帳單</h3>
                        <p className={`text-sm font-bold ${t.textM} mt-1.5`}>時間到自動提醒繳費</p>
                      </div>
                      <button onClick={() => updateUi({ modal: 'bill' })} className={`px-5 py-3 ${t.cardInner} border ${t.border} rounded-full text-sm font-bold shadow-sm active:scale-95`}>
                        + 新增帳單
                      </button>
                    </div>

                    {data.bills.length === 0 ? (
                      <div className={`py-20 text-center text-lg font-bold ${t.textM} ${t.cardInner} rounded-[2rem] border ${t.border} shadow-sm`}>沒有固定帳單</div>
                    ) : data.bills.map(b => (
                      <div key={b.id} className={`p-6 rounded-[2rem] flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm ${b.isPaid ? 'opacity-50' : ''}`}>
                        <div className="flex gap-5 items-center">
                          <div className={`text-4xl ${t.bg} w-16 h-16 flex justify-center items-center rounded-full`}>{b.icon}</div>
                          <div>
                            <div className="font-bold text-xl">{b.name}</div>
                            <div className={`text-sm font-bold ${t.textM} mt-1.5`}>{b.isPaid ? '已繳' : `每月 ${b.dueDate} 號`}</div>
                          </div>
                        </div>
                        <div className="flex gap-4 items-center">
                          <span className="font-black text-3xl">${b.amount}</span>
                          {!b.isPaid && (
                            <button onClick={() => doAction(() => updateDoc(getDocRef('shared_bills', b.id), {isPaid: true}), "已繳款")} className={`p-3 rounded-full ${t.primary} text-white shadow-sm`}>
                              <Check className="w-6 h-6"/>
                            </button>
                          )}
                          <Trash2 onClick={() => confirmDel('刪除帳單？', () => deleteDoc(getDocRef('shared_bills', b.id)))} className={`w-6 h-6 ${t.textM} hover:text-red-500 cursor-pointer`}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {ui.subTab === 'shopping' && (
                  <div className="space-y-5">
                    <form onSubmit={e => { e.preventDefault(); const v = e.target.item.value.trim(); if(v) doAction(() => addDoc(getCol('shared_shopping'), {text: v, completed: false, createdAt: serverTimestamp()})); e.target.reset(); }} className="flex gap-4 mb-8">
                      <input name="item" placeholder="新增待買物品..." className={`flex-1 px-6 py-5 rounded-2xl border ${t.border} ${t.cardInner} font-bold text-xl shadow-sm focus:outline-none focus:ring-2 ${t.ring}`}/>
                      <button type="submit" className={`px-8 rounded-2xl ${t.primary} text-white shadow-sm`}><Plus className="w-8 h-8"/></button>
                    </form>
                    
                    {data.shopping.length === 0 ? (
                      <div className={`py-20 text-center text-lg font-bold ${t.textM} ${t.cardInner} rounded-[2rem] border ${t.border} shadow-sm`}>購物清單空空如也！</div>
                    ) : data.shopping.map(s => (
                      <div key={s.id} className={`p-6 rounded-3xl flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm`}>
                        <div className="flex gap-4 items-center flex-1 cursor-pointer" onClick={() => updateDoc(getDocRef('shared_shopping', s.id), {completed: !s.completed})}>
                          <CheckCircle2 className={`w-8 h-8 ${s.completed ? 'text-emerald-500' : t.textM}`}/>
                          <span className={`font-bold text-xl ${s.completed ? 'line-through opacity-50' : ''}`}>{s.text}</span>
                        </div>
                        <Trash2 onClick={() => confirmDel('刪除物品？', () => deleteDoc(getDocRef('shared_shopping', s.id)))} className={`w-6 h-6 ${t.textM} hover:text-red-500 cursor-pointer`}/>
                      </div>
                    ))}
                  </div>
                )}

                {ui.subTab === 'notes' && (
                  <div className="space-y-5">
                    <div className="flex justify-between items-center mb-8 px-2">
                      <div>
                        <h3 className="text-2xl font-black">共同記事</h3>
                        <p className={`text-sm font-bold ${t.textM} mt-1.5`}>記錄生活大小事</p>
                      </div>
                      <button onClick={() => updateUi({ modal: 'note', selectedItem: null })} className={`px-5 py-3 ${t.primary} text-white rounded-full text-sm font-bold shadow-sm active:scale-95`}>
                        + 新增筆記
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      {data.notes.map(n => (
                        <div key={n.id} onClick={() => updateUi({ selectedItem: n, modal: 'note' })} className={`${t.cardInner} border ${t.border} rounded-3xl p-6 cursor-pointer min-h-[180px] relative shadow-sm`}>
                          <h4 className={`font-extrabold text-xl mb-3 truncate ${t.text}`}>{n.title}</h4>
                          <p className={`text-sm opacity-70 line-clamp-4 font-bold ${t.textM} leading-relaxed`}>{n.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ui.subTab === 'events' && (
                  <div className="space-y-5">
                    <div className="flex justify-between items-center mb-8 px-2">
                      <div>
                        <h3 className="text-2xl font-black">重要日子倒數</h3>
                        <p className={`text-sm font-bold ${t.textM} mt-1.5`}>紀念日與行程</p>
                      </div>
                      <button onClick={() => updateUi({ modal: 'event' })} className={`px-5 py-3 bg-pink-500/10 text-pink-500 border border-pink-500/20 rounded-full text-sm font-bold shadow-sm active:scale-95`}>
                        + 新增日子
                      </button>
                    </div>

                    {data.events.length === 0 ? (
                       <div className={`py-20 text-center text-lg font-bold ${t.textM} ${t.cardInner} rounded-[2rem] border ${t.border} shadow-sm`}>還沒有設定重要的日子喔！</div>
                    ) : data.events.map(e => { 
                      const d = calculateDaysDiff(e.date); 
                      return (
                        <div key={e.id} className={`p-6 rounded-[2rem] flex justify-between items-center border ${t.border} ${t.cardInner} shadow-sm`}>
                          <div className="flex gap-5 items-center">
                            <div className="text-4xl bg-pink-500/10 w-16 h-16 flex items-center justify-center rounded-full">{e.icon}</div>
                            <div>
                              <div className="font-bold text-xl">{e.title}</div>
                              <div className={`text-sm font-bold ${t.textM} mt-1.5`}>{e.date}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-5">
                            <span className="font-black text-3xl text-pink-500">{d === 0 ? '今天' : d}</span>
                            <Trash2 onClick={() => confirmDel('刪除日子？', () => deleteDoc(getDocRef('shared_events', e.id)))} className={`w-6 h-6 ${t.textM} hover:text-red-500 cursor-pointer`}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {ui.subTab === 'goals' && (
                  <div className="space-y-6 animate-in fade-in">
                 <div className="flex justify-between items-center px-2">
                   <h2 className="text-2xl font-black">夢想撲滿</h2>
                   <button onClick={() => updateUi({ modal: 'goal' })} className={`text-sm font-bold ${t.cardInner} border ${t.border} px-5 py-3 rounded-full shadow-sm`}>+ 新增願望</button>
                 </div>
                 <div className="grid grid-cols-1 gap-6">
                  {data.goals.length === 0 ? (
                    <div className={`${t.cardInner} p-16 rounded-[2.5rem] border ${t.border} text-center shadow-sm font-bold`}>
                      <Target className={`w-20 h-20 ${t.textM} mx-auto mb-5 opacity-50`} />
                      <p className={`text-lg ${t.textM}`}>還沒有設定存錢目標喔！</p>
                    </div>
                  ) : data.goals.map(g => {
                    const prog = Math.min((g.currentAmount / g.targetAmount) * 100, 100); 
                    const isOk = prog >= 100;
                    return (
                      <div key={g.id} className={`p-8 rounded-[2.5rem] border ${t.border} ${t.cardInner} shadow-sm relative overflow-hidden`}>
                        <div className="flex justify-between items-center mb-6 pr-8">
                          <div className="font-extrabold text-2xl flex items-center gap-3">{isOk ? '🎉' : '🎯'} {g.title}</div>
                          <div className={`text-sm font-black ${t.primaryText} ${t.bg} px-3 py-1.5 rounded-lg`}>{prog.toFixed(0)}%</div>
                        </div>
                        <div className="flex justify-between items-end mb-4">
                          <span className="text-5xl font-black">${g.currentAmount.toLocaleString()}</span>
                          <span className={`text-base font-bold ${t.textM}`}>/ ${g.targetAmount.toLocaleString()}</span>
                        </div>
                        <div className={`h-4 w-full ${t.bg} rounded-full overflow-hidden mb-6`}>
                          <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isOk ? 'bg-emerald-500' : t.primary}`} style={{ width: `${prog}%` }}></div>
                        </div>
                        {!isOk && (
                          <button onClick={() => updateUi({ modal: 'fund', selectedItem: g })} className={`w-full py-5 ${t.bg} font-bold text-base rounded-2xl flex justify-center items-center gap-2 active:scale-95 border ${t.border}`}>
                            <Coins className={`w-6 h-6 ${t.primaryText}`} /> 存入資金
                          </button>
                        )}
                        <Trash2 onClick={() => confirmDel('刪除目標？', () => deleteDoc(getDocRef('shared_goals', g.id)))} className={`absolute top-9 right-8 w-6 h-6 ${t.textM} hover:text-red-500 cursor-pointer z-10`}/>
                      </div>
                    )
                  })}
                 </div>
              </div>
                )}
              </div>
            )}
          </main>

          {/* ================= 浮動導覽列 ================= */}
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <div className="w-full max-w-md md:max-w-xl relative pointer-events-auto">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-50">
                {/* 加大中間的 + 號 */}
                <button onClick={() => updateUi({ modal: 'tx', selectedTx: null })} className={`h-[84px] w-[84px] ${ui.isDark ? 'bg-indigo-600' : 'bg-[#C86D23]'} text-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform border-[6px] ${ui.isDark ? 'border-[#1E293B]' : 'border-white'}`}>
                  <Plus className="w-10 h-10" strokeWidth={3} />
                </button>
              </div>
              <nav className={`w-full ${t.cardInner} border-t ${t.border} px-8 pb-safe pt-3 flex justify-between items-center h-[90px] rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]`}>
                <div className="flex gap-8">
                  <button onClick={() => updateUi({ tab: 'home' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'home' ? t.primaryText : t.textM}`}>
                    <Home className="w-7 h-7" />
                    <span className="text-xs font-bold">首頁</span>
                  </button>
                  <button onClick={() => updateUi({ tab: 'wallets' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'wallets' ? t.primaryText : t.textM}`}>
                    <Wallet className="w-7 h-7" />
                    <span className="text-xs font-bold">帳戶</span>
                  </button>
                </div>
                <div className="w-20 shrink-0"></div> 
                <div className="flex gap-8">
                  <button onClick={() => updateUi({ tab: 'stats' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'stats' ? t.primaryText : t.textM}`}>
                    <PieChartIcon className="w-7 h-7" />
                    <span className="text-xs font-bold">統計</span>
                  </button>
                  <button onClick={() => updateUi({ tab: 'life' })} className={`flex flex-col items-center gap-1.5 ${ui.tab === 'life' ? t.primaryText : t.textM}`}>
                    <ClipboardList className="w-7 h-7" />
                    <span className="text-xs font-bold">生活</span>
                  </button>
                </div>
              </nav>
            </div>
          </div>

          {/* ================= 彈出視窗 (Modals) ================= */}
          {ui.modal && (
            <div className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in">
              <div className={`w-full max-w-md md:max-w-xl ${t.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] pt-8 px-7 pb-0 border ${t.border} max-h-[95vh] flex flex-col shadow-2xl overflow-hidden`}>
                <div className="flex justify-between items-center mb-6 shrink-0 px-2">
                  <h3 className="font-black text-3xl flex items-center gap-3">
                    {ui.modal === 'settings' && <Settings className={`w-8 h-8 ${t.textM}`}/>}
                    {ui.modal === 'barcode' && <Barcode className={`w-8 h-8 ${t.textM}`}/>}
                    {ui.modal === 'notify' && <Bell className={`w-8 h-8 ${t.textM}`}/>}
                    {ui.modal === 'tx' ? (ui.selectedTx ? '修改紀錄' : '新增紀錄') : ui.modal === 'settings' ? '設定與管理' : ui.modal === 'barcode' ? '發票載具' : ui.modal === 'notify' ? '推播與通知' : '選單'}
                  </h3>
                  <button onClick={() => updateUi({ modal: null, selectedTx: null })} className={`p-3 ${t.bg} rounded-full active:scale-95`}>
                    <X className={`w-7 h-7 ${t.textM}`}/>
                  </button>
                </div>
                
                {/* 彈窗內容區塊 */}
                <div className="flex-1 overflow-y-auto hide-scrollbar pb-safe">
                  {ui.modal === 'tx' && (
                    <TxForm 
                      accounts={data.accounts} cats={CATEGORIES} tags={data.tags} initialData={ui.selectedTx} 
                      templates={data.templates} settings={settings}
                      onAI={() => updateUi({ modal: 'ai' })} onAddTag={handleAddGlobalTag}
                      onSaveTemplate={(tpl) => doAction(() => addDoc(getCol('shared_templates'), {...tpl, createdAt: serverTimestamp()}), '範本已儲存')}
                      onDeleteTemplate={(id) => doAction(() => deleteDoc(getDocRef('shared_templates', id)), '範本已移除')}
                      onSave={(txData) => { 
                        const { id, ...payload } = txData;
                        payload.updatedAt = serverTimestamp();
                        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
                        if(id) {
                          doAction(() => updateDoc(getDocRef('shared_ledger', id), payload), '修改成功'); 
                        } else {
                          payload.date = getLocalYYYYMMDD(ui.date);
                          payload.month = getLocalYYYYMM(ui.date);
                          payload.createdAt = serverTimestamp();
                          payload.createdBy = user ? user.uid : 'unknown';
                          doAction(() => addDoc(getCol('shared_ledger'), payload), '記帳成功'); 
                        }
                      }} 
                      t={t} ui={ui}
                    />
                  )}
                  {ui.modal === 'ai' && (
                    <AIForm cats={CATEGORIES} accounts={data.accounts} onBack={() => updateUi({ modal: 'tx' })} onSave={(txData) => doAction(() => addDoc(getCol('shared_ledger'), {...txData, date: getLocalYYYYMMDD(ui.date), month: getLocalYYYYMM(ui.date), createdAt: serverTimestamp(), createdBy: user ? user.uid : 'unknown'}), 'AI 記帳成功')} showToast={showToast} t={t} ui={ui} />
                  )}
                  {ui.modal === 'date' && (
                    <div className="grid grid-cols-3 gap-4">
                      {Array.from({length:12}).map((_,i) => (
                        <button key={i} onClick={() => { updateUi({ date: new Date(ui.date.getFullYear(), i, 1), modal: null }); }} className={`py-6 rounded-3xl font-bold border text-2xl active:scale-95 transition-all ${ui.date.getMonth()===i ? `${t.primary} text-white border-transparent shadow-md` : `${t.bg} ${t.border}`}`}>
                          {i+1}月
                        </button>
                      ))}
                    </div>
                  )}
                  {ui.modal === 'settings' && (
                    <SettingsForm settings={settings} onSave={(s) => doAction(() => setDoc(getDocRef('shared_settings', 'main'), s, {merge:true}), '設定已儲存')} onExport={handleExportToSheets} onRecurring={() => updateUi({ modal: 'recurring' })} t={t} />
                  )}
                  {ui.modal === 'recurring' && (
                    <RecurringForm 
                      rules={data.recurringRules} accounts={data.accounts} cats={CATEGORIES} 
                      onSave={r => doAction(() => addDoc(getCol('recurring_rules'), r), '自動記帳規則已建立')} 
                      onDelete={id => confirmDel('刪除此規則？', () => deleteDoc(getDocRef('recurring_rules', id)))} 
                      t={t} 
                    />
                  )}
                  {ui.modal === 'barcode' && (
                    <BarcodeForm codes={{h:settings.husbandBarcode, w:settings.wifeBarcode}} onSave={(h, w) => doAction(() => setDoc(getDocRef('shared_settings', 'main'), {husbandBarcode:h, wifeBarcode:w}, {merge:true}), '載具已儲存')} t={t} />
                  )}
                  
                  {ui.modal === 'notify' && (
                    <div className="space-y-5">
                      {activeAlerts.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-20 text-center ${t.textM}`}>
                          <Bell className="w-20 h-20 mb-5 opacity-50" />
                          <span className="font-bold text-xl">目前沒有任何新通知 🎉</span>
                        </div>
                      ) : activeAlerts.map(a => (
                        <div key={a.id} className={`flex items-center gap-5 p-6 rounded-3xl border ${t.border} ${t.bg} relative shadow-sm`}>
                          <div className={`w-16 h-16 rounded-full ${t.cardInner} flex items-center justify-center text-4xl shadow-sm shrink-0`}>
                            {a.icon}
                          </div>
                          <div className="flex-1 pr-8">
                            <h4 className="font-extrabold text-xl mb-2">{a.title}</h4>
                            <p className={`text-base font-bold ${t.textM}`}>{a.desc}</p>
                          </div>
                          <button 
                            onClick={() => setDismissedAlerts(prev => [...prev, a.id])} 
                            className={`absolute top-6 right-6 text-stone-400 hover:text-rose-500 active:scale-95 transition-colors`}
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {ui.modal === 'account' && (
                    <AccForm onSave={d => doAction(() => addDoc(getCol('shared_accounts'), {...d, createdAt: serverTimestamp()}), '帳戶建立')} t={t} />
                  )}
                  {ui.modal === 'bill' && (
                    <BillForm onSave={d => doAction(() => addDoc(getCol('shared_bills'), {...d, isPaid: false, createdAt: serverTimestamp()}), '帳單建立')} t={t} />
                  )}
                  {ui.modal === 'note' && (
                    <NoteForm 
                      data={ui.selectedItem} 
                      onSave={d => {
                        const { id, ...payload } = d;
                        payload.updatedAt = serverTimestamp();
                        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
                        if (id) doAction(() => updateDoc(getDocRef('shared_notes', id), payload), '修改成功');
                        else { payload.createdAt = serverTimestamp(); doAction(() => addDoc(getCol('shared_notes'), payload), '新增成功'); }
                      }} 
                      onDelete={id => confirmDel('刪除筆記？', () => deleteDoc(getDocRef('shared_notes', id)))} 
                      t={t} 
                    />
                  )}
                  {ui.modal === 'event' && (
                    <EventForm onSave={d => doAction(() => addDoc(getCol('shared_events'), {...d, createdAt: serverTimestamp()}), '建立成功')} t={t} />
                  )}
                  {ui.modal === 'goal' && (
                    <GoalForm onSave={d => doAction(() => addDoc(getCol('shared_goals'), {...d, currentAmount: 0, createdAt: serverTimestamp()}), '目標建立')} t={t} />
                  )}
                  {ui.modal === 'fund' && (
                    <FundForm goal={ui.selectedItem} onSave={amt => doAction(() => updateDoc(getDocRef('shared_goals', ui.selectedItem.id), {currentAmount: ui.selectedItem.currentAmount + amt}), '存入成功')} t={t} />
                  )}
                  {ui.modal === 'tags' && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-3">
                        {data.tags.map(tag => (
                          <button key={tag} onClick={() => updateUi({filterTags: ui.filterTags.includes(tag) ? ui.filterTags.filter(x=>x!==tag) : [...ui.filterTags,tag]})} className={`px-5 py-3 rounded-2xl text-base font-bold border-2 ${ui.filterTags.includes(tag) ? `${t.primary} text-white border-transparent shadow-sm` : `${t.bg} ${t.border}`}`}>
                            #{tag}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => updateUi({filterTags:[], modal:null})} className={`w-full py-5 rounded-2xl font-bold text-xl ${t.bg} active:scale-95`}>清除篩選</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </React.Fragment>
  );
}

// ==========================================
// 4. 獨立子組件庫 (Forms & Modals)
// ==========================================

// 🌟 記帳表單 (視覺鎖定計算機 + 一鍵範本 + 折疊按鈕 + OCR 防呆)
const TxForm = ({ accounts, cats, tags, initialData, templates, settings, onAI, onAddTag, onSaveTemplate, onDeleteTemplate, onSave, t, ui }) => {
  const [data, setData] = useState({ 
    id: initialData?.id || null, type: initialData?.type || 'expense', 
    category: initialData?.category || cats?.expense?.[0]?.name || '餐飲', 
    accountId: initialData?.accountId || (accounts[0]?.id || ''), fromAccountId: initialData?.fromAccountId || (accounts[0]?.id || ''),
    toAccountId: initialData?.toAccountId || (accounts[1]?.id || ''), amount: initialData ? String(initialData.amount) : '', 
    note: initialData?.note || '', payer: initialData?.payer || 'joint', split: initialData?.split || 'half', tags: initialData?.tags || [] 
  });
  
  const [showK, setShowK] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [isOCR, setIsOCR] = useState(false);
  const fileInputRef = useRef(null);
  
  const evaluateMath = (str) => {
    try {
      if (!str) return '';
      const safeStr = str.replace(/×/g, '*').replace(/÷/g, '/');
      if (/^[0-9+\-*/.()]+$/.test(safeStr)) {
        const result = new Function(`return ${safeStr}`)();
        return isNaN(result) || !isFinite(result) ? str : String(Math.round(result * 100) / 100);
      }
      return str;
    } catch { return str; }
  };

  const handleKey = (k) => {
    if (k === '=') setData({...data, amount: evaluateMath(data.amount)});
    else if (k === 'C') setData({...data, amount: ''});
    else if (k === '⌫') setData({...data, amount: data.amount.slice(0, -1)});
    else setData({...data, amount: data.amount + k});
  };

  const submit = () => { 
    let finalAmount = Number(evaluateMath(data.amount));
    if (settings.travelMode && finalAmount > 0) {
      finalAmount = Math.round(finalAmount * (settings.travelRate || 1));
      data.note = `[${settings.travelCurrency} ${data.amount}] ${data.note}`;
    }
    if (finalAmount > 0) onSave({...data, amount: finalAmount}); 
  };
  
  const handleAddNewTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onAddTag(newTag.trim()); setData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] })); setNewTag('');
    }
  };

  const handleSaveTemplate = () => {
    if (!data.amount || !data.category) return alert("請先填寫金額與分類！");
    const name = window.prompt("請為這個一鍵記帳範本命名 (例如：買咖啡)：");
    if (name) {
      onSaveTemplate({ name, txData: { ...data, amount: Number(evaluateMath(data.amount)) } });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !apiKey || apiKey.includes("請在此貼上")) return alert("請先設定正確的 API 金鑰");
    
    setIsOCR(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const resData = await fetchWithBackoff(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: `請分析這張收據/發票，並回傳 JSON 格式。包含：amount (數字，總金額), note (字串，商店名稱或購買品項)。若無法辨識則留空。` },
              { inlineData: { mimeType: file.type, data: base64Data } }
            ]}],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (resData.candidates) {
          const rawText = resData.candidates[0].content.parts[0].text;
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          const result = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
          setData(prev => ({ ...prev, amount: String(result.amount || prev.amount), note: result.note || prev.note }));
        }
        setIsOCR(false);
      };
    } catch (err) {
      console.error(err);
      alert("照片解析失敗，可能為金鑰權限問題");
      setIsOCR(false);
    }
  };

  return (
    <div className="flex flex-col h-[75vh]">
      {/* 🌟 上半部：可滾動的設定區 */}
      <div className="flex-1 overflow-y-auto space-y-5 px-1 pb-6 hide-scrollbar">
        
        {/* 一鍵記帳範本區 (可橫向捲動) */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2 mb-2">
          {templates && templates.map(tpl => (
            <div key={tpl.id} className={`relative flex items-center shrink-0 ${t.bg} border ${t.border} rounded-2xl pl-4 pr-10 py-3 shadow-sm group`}>
               <span 
                 onClick={() => setData({ ...data, ...tpl.txData, amount: String(tpl.txData.amount) })} 
                 className={`font-bold text-base cursor-pointer ${t.text}`}
               >
                 {tpl.name}
               </span>
               <button 
                 onClick={() => onDeleteTemplate(tpl.id)} 
                 className="absolute right-3 text-stone-400 hover:text-red-500 transition-colors p-1"
               >
                 <X className="w-4 h-4" strokeWidth={3} />
               </button>
            </div>
          ))}
          <button 
             onClick={handleSaveTemplate} 
             className={`shrink-0 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed ${t.border} rounded-2xl text-sm font-bold ${t.textM} hover:${t.primaryText} transition-colors`}
          >
             <Save className="w-5 h-5" /> 存為範本
          </button>
        </div>

        {!initialData && (
          <button onClick={onAI} className={`w-full py-5 rounded-2xl text-lg font-bold flex justify-center items-center gap-3 ${t.primary} text-white shadow-md active:scale-95`}>
            <Wand2 className="w-6 h-6" /> AI 語音 / 文字智能記帳
          </button>
        )}
        
        <div className={`flex ${t.bg} p-2 rounded-2xl border ${t.border}`}>
          <button onClick={() => setData({...data, type:'expense', category:cats.expense[0].name})} className={`flex-1 py-4 font-bold text-base rounded-xl transition-all ${data.type === 'expense' ? `${t.cardInner} shadow-sm` : t.textM}`}>支出</button>
          <button onClick={() => setData({...data, type:'income', category:cats.income[0].name})} className={`flex-1 py-4 font-bold text-base rounded-xl transition-all ${data.type === 'income' ? `${t.cardInner} shadow-sm` : t.textM}`}>收入</button>
          <button onClick={() => setData({...data, type:'transfer', category:''})} className={`flex-1 py-4 font-bold text-base rounded-xl transition-all ${data.type === 'transfer' ? `${t.cardInner} shadow-sm` : t.textM}`}>轉帳</button>
        </div>
        
        {data.type === 'transfer' ? (
          <div className="flex gap-4 items-center">
            <div className="flex-1 space-y-3">
              <label className={`font-bold text-sm ${t.textM}`}>從</label>
              <select value={data.fromAccountId} onChange={e => setData({...data, fromAccountId: e.target.value})} className={`w-full p-5 rounded-2xl font-bold text-base ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <ArrowRightLeft className={`w-6 h-6 mt-6 ${t.textM}`} />
            <div className="flex-1 space-y-3">
              <label className={`font-bold text-sm ${t.textM}`}>轉入</label>
              <select value={data.toAccountId} onChange={e => setData({...data, toAccountId: e.target.value})} className={`w-full p-5 rounded-2xl font-bold text-base ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`}>
                {accounts.filter(a => a.id !== data.fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {cats[data.type] && cats[data.type].map(c => (
              <button key={c.name} onClick={() => setData({...data, category: c.name})} className={`py-5 rounded-2xl border-2 ${data.category === c.name ? t.primary + ' text-white border-transparent shadow-md' : `${t.bg} ${t.border}`} flex flex-col items-center transition-all active:scale-95`}>
                <span className="text-4xl mb-2">{c.icon}</span><span className="text-sm font-bold">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {data.type !== 'transfer' && (
          <div className="space-y-3">
            <label className={`font-bold text-sm ${t.textM}`}>帳戶</label>
            <select value={data.accountId} onChange={e => setData({...data, accountId: e.target.value})} className={`w-full p-5 rounded-2xl ${t.bg} font-bold text-lg border-none outline-none focus:ring-2 ${t.ring}`}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        
        {/* 🏷️ 標籤 (Tags) */}
        <div className="space-y-4">
          <div className="flex gap-4">
            <input type="text" placeholder="新增標籤..." value={newTag} onChange={(e) => setNewTag(e.target.value)} className={`flex-1 p-5 rounded-2xl ${t.bg} border-none font-bold text-base outline-none focus:ring-2 ${t.ring}`} />
            <button onClick={handleAddNewTag} disabled={!newTag.trim()} className={`px-6 rounded-2xl ${t.primary} text-white font-bold text-base disabled:opacity-50 shadow-sm active:scale-95`}>新增</button>
          </div>
          <div className="flex flex-wrap gap-3">
            {tags.map(tg => (
              <button key={tg} onClick={() => setData(prev => ({...prev, tags: prev.tags.includes(tg) ? prev.tags.filter(x=>x!==tg) : [...prev.tags, tg]}))} className={`px-4 py-2 rounded-xl text-sm font-bold border ${data.tags.includes(tg) ? `${t.primary} text-white border-transparent` : `${t.bg} ${t.border}`}`}>#{tg}</button>
            ))}
          </div>
        </div>

        {/* 📷 備註與相機 OCR */}
        <div className="flex gap-4">
          <input type="text" placeholder="備註..." value={data.note} onChange={e => setData({...data, note: e.target.value})} className={`flex-1 p-5 rounded-2xl ${t.bg} border-none font-bold text-lg outline-none focus:ring-2 ${t.ring}`} />
          <button 
            onClick={() => fileInputRef.current.click()} 
            disabled={isOCR}
            className={`p-5 rounded-2xl font-bold flex items-center justify-center active:scale-95 ${t.bg} border-none ${t.textM} relative shadow-sm`}
          >
            {isOCR ? <Loader2 className="animate-spin w-7 h-7" /> : <Camera className="w-7 h-7" />}
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />
          </button>
        </div>
        
        {data.type !== 'transfer' && (
          <div className={`p-4 rounded-2xl border ${t.border} ${t.bg} flex items-center gap-4 mb-12`}>
            <span className={`text-sm font-bold w-14 ${t.textM} px-2`}>付款人</span>
            <div className="flex gap-3 flex-1">
              {['husband', 'wife', 'joint'].map(r => (
                <button key={r} onClick={() => setData({...data, payer: r})} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${data.payer === r ? `${t.primary} text-white shadow-sm` : `${t.cardInner} ${t.textM} border ${t.border}`}`}>{r === 'husband' ? '老公' : r === 'wife' ? '老婆' : '共同'}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 折疊按鈕 */}
      <div className="flex justify-center -mb-5 relative z-10">
         <button onClick={() => setShowK(!showK)} className={`bg-white dark:bg-slate-800 border ${t.border} rounded-full p-2 shadow-md text-stone-400 hover:text-indigo-500 transition-transform ${!showK ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-6 h-6" />
         </button>
      </div>
      
      {/* 🌟 下半部：永久鎖定在底部的「大金額顯示 + 4x4 計算機」 */}
      {showK && (
        <div className={`shrink-0 border-t ${t.border} pt-6 pb-safe bg-transparent shadow-[0_-4px_10px_rgba(0,0,0,0.02)] animate-in slide-in-from-bottom-2`}>
          {/* 金額顯示鎖定在這裡，打字不怕看不到！ */}
          <div className={`flex justify-between items-center px-5 py-4 mx-2 mb-4 rounded-2xl ${ui.isDark ? 'bg-[#1E293B] shadow-inner' : 'bg-stone-50 border border-stone-200'}`}>
            <span className={`font-bold text-base ${t.textM}`}>
              {settings.travelMode ? `輸入 ${settings.travelCurrency}` : '輸入金額'}
            </span>
            <span className={`text-5xl font-black ${t.text} truncate max-w-[200px] text-right`}>{data.amount || '0'}</span>
          </div>

          {/* 4x4 真四則運算計算機陣列 */}
          <div className={`grid grid-cols-4 gap-3 px-2 pb-2`}>
            {['7','8','9','÷', '4','5','6','×', '1','2','3','-', 'C','0','.','+', '⌫','00','=','OK'].map((k, i) => {
              const isOp = ['÷','×','-','+','='].includes(k);
              const isC = k === 'C' || k === '⌫';
              let btnClass = '';
              
              if (ui.isDark) {
                if (isOp) btnClass = 'bg-[#1E293B] text-rose-500'; 
                else if (isC) btnClass = 'bg-[#1E293B] text-stone-400'; 
                else btnClass = 'bg-[#111827] text-white shadow-sm'; 
              } else {
                if (isOp) btnClass = 'bg-stone-200 text-rose-500'; 
                else if (isC) btnClass = 'bg-stone-300 text-stone-600'; 
                else btnClass = 'bg-white text-stone-800 shadow-sm border border-stone-100'; 
              }

              return (
                <button key={i} onClick={() => k === 'OK' ? submit() : handleKey(k)} className={`h-[64px] rounded-2xl font-black text-2xl active:scale-95 transition-all ${k === 'OK' ? `col-span-1 ${t.primary} text-white shadow-md` : btnClass}`}>
                  {k}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 如果收起鍵盤，只顯示大確認按鈕與金額 */}
      {!showK && (
        <div className={`shrink-0 border-t ${t.border} pt-5 pb-safe px-2 bg-transparent animate-in slide-in-from-bottom-2`}>
           <button onClick={submit} className={`w-full py-5 rounded-2xl font-black text-2xl text-white shadow-md active:scale-95 ${ui.isDark ? t.primary : 'bg-[#A29188]'}`}>
             確認{initialData ? '修改' : '記帳'} (${data.amount || '0'})
           </button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 🌟 AI 語音記帳表單 (完美 URL Param 防護版)
// ==========================================
const AIForm = ({ cats, accounts, onBack, onSave, showToast, t, ui }) => {
  const [text, setText] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'zh-TW';
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setText(prev => prev ? `${prev} ${transcript}` : transcript);
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return showToast("您的瀏覽器不支援語音功能，請用打字的", "error");
    if (isListening) recognitionRef.current.stop();
    else { recognitionRef.current.start(); setIsListening(true); }
  };
  
  const handleParse = async () => {
    if (!apiKey || apiKey.includes("請在此貼上")) {
      showToast("錯誤：請前往 Google AI Studio 申請新金鑰", "error");
      return;
    }
    if (!text.trim()) return; 
    setLoading(true);
    try {
       // 🌟 使用 URL 綁定 Key 避免 401 錯誤
       const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
       const options = {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: `請將以下語言記帳轉換為JSON。語言：「${text}」。這是家庭帳本。必填欄位：amount(數字), category(從[${cats.expense.map(c=>c.name).join(',')}]選), type('expense'/'income'/'transfer'), accountId(選擇一個 ID: [${accounts.map(a=>`${a.name}:${a.id}`).join(',')}]), payer('husband'/'wife'/'joint'), note(備註)。若無法判斷則填預設值。` }] }]
          })
       };

       const resData = await fetchWithBackoff(url, options);
       
       if(!resData || !resData.candidates || !resData.candidates[0]) throw new Error("API 回傳異常");
       
       const rawText = resData.candidates[0].content.parts[0].text;
       const jsonMatch = rawText.match(/\{[\s\S]*\}/);
       const result = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
       
       onSave({ 
         amount: result.amount || 0, category: result.category || cats.expense[0].name, type: result.type || 'expense', 
         accountId: result.accountId || accounts[0]?.id || '', payer: result.payer || 'joint', split: 'half', note: result.note || '', tags: ['AI記帳']
       });
    } catch (e) { showToast(`AI 解析失敗: ${e.message}`, "error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <button onClick={onBack} className={`text-base font-bold ${t.textM} mb-3 flex items-center gap-2 shrink-0`}><ChevronLeft className="w-5 h-5"/> 返回手動記帳</button>
      <div className="relative flex-1">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="點擊右下角麥克風說話，例如：「昨天去全聯買便當花了 200，老婆付的...」" className={`w-full h-full p-6 rounded-3xl font-bold text-2xl resize-none focus:ring-2 ${t.ring} ${t.bg} border-none outline-none`} />
        <button onClick={toggleListening} className={`absolute bottom-6 right-6 p-6 rounded-full shadow-2xl transition-transform ${isListening ? 'bg-rose-500 text-white animate-pulse scale-110' : `${t.primary} text-white hover:scale-105`}`}>
          {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
        </button>
      </div>
      <button onClick={handleParse} disabled={loading || !text} className={`w-full py-6 rounded-2xl font-black text-2xl ${t.primary} text-white flex justify-center items-center gap-3 mt-4 shrink-0 shadow-lg disabled:opacity-50 active:scale-95`}>
        {loading ? <Loader2 className="animate-spin w-7 h-7"/> : <Sparkles className="w-7 h-7"/>} 交給 AI 自動解析
      </button>
    </div>
  );
}

// ==========================================
// 高質感設定表單 (包含旅遊模式)
// ==========================================
const SettingsForm = ({ settings, onSave, onExport, onRecurring, t }) => {
  const [s, setS] = useState(settings);
  const isDark = t.bg.includes('0F172A') || t.bg.includes('1E1B18') || t.bg.includes('001f3f'); 
  return (
    <div className="space-y-5">
      {/* ✈️ 旅遊多幣別模式 */}
      <div className={`${t.bg} rounded-3xl p-6 border ${t.border} shadow-sm space-y-5`}>
         <div className="flex justify-between items-center">
           <h4 className={`font-bold text-lg flex items-center gap-2 ${s.travelMode ? 'text-[#0074D9]' : t.text}`}><Plane className="w-6 h-6"/> 旅遊模式 (多幣別)</h4>
           <ToggleSwitch checked={s.travelMode} onChange={val => setS({...s, travelMode: val})} isDark={isDark} />
         </div>
         {s.travelMode && (
           <div className={`space-y-4 pt-4 border-t ${t.border}`}>
             <div className="flex justify-between items-center">
               <span className={`text-base font-bold ${t.textM}`}>記帳幣別</span>
               <input value={s.travelCurrency || 'JPY'} onChange={e => setS({...s, travelCurrency: e.target.value.toUpperCase()})} className={`w-24 ${t.cardInner} p-3 rounded-xl font-bold text-lg text-center border ${t.border} outline-none focus:ring-2 ${t.ring}`} placeholder="JPY" />
             </div>
             <div className="flex justify-between items-center">
               <span className={`text-base font-bold ${t.textM}`}>對台幣匯率</span>
               <input type="number" step="0.01" value={s.travelRate || 0.21} onChange={e => setS({...s, travelRate: Number(e.target.value)})} className={`w-28 ${t.cardInner} p-3 rounded-xl font-bold text-lg text-center border ${t.border} outline-none focus:ring-2 ${t.ring}`} />
             </div>
             <p className={`text-sm ${t.textM}`}>開啟後，記帳時輸入的金額將自動乘上匯率轉為台幣。</p>
           </div>
         )}
      </div>

      <div className={`${t.bg} rounded-3xl p-6 border ${t.border} shadow-sm space-y-5`}>
         <h4 className={`font-bold text-base ${t.textM} mb-2`}>家庭總預算</h4>
         <div className={`flex items-center gap-3 ${t.cardInner} rounded-2xl p-5`}>
           <span className={`font-bold text-2xl ${t.textM}`}>$</span>
           <input type="number" value={s.monthlyBudget} onChange={e => setS({...s, monthlyBudget: Number(e.target.value)})} className={`w-full bg-transparent font-bold text-3xl border-none focus:outline-none`} />
         </div>
         <div className={`flex justify-between items-center pt-3`}>
           <span className={`font-bold text-base ${t.text}`}>預算結轉機制</span>
           <ToggleSwitch checked={s.enableRollover} onChange={val => setS({...s, enableRollover: val})} isDark={isDark} />
         </div>
      </div>

      <div className={`${t.bg} rounded-3xl p-6 border ${t.border} shadow-sm`}>
         <h4 className={`font-bold text-base ${t.textM} mb-5 flex items-center gap-2`}><Bell className="w-5 h-5"/>推播與通知中心</h4>
         <div className={`space-y-5 pb-5 border-b ${t.border}`}>
           <div className="flex justify-between items-center">
             <span className={`font-bold text-base ${t.text}`}>大額消費防護網</span>
             <ToggleSwitch checked={s.notifyLargeExpense} onChange={val => setS({...s, notifyLargeExpense: val})} isDark={isDark} />
           </div>
           {s.notifyLargeExpense && (
             <div className={`flex items-center gap-3 ${t.cardInner} p-4 rounded-2xl`}>
               <span className={`text-sm ${t.textM} font-bold px-1`}>觸發金額大於 $</span>
               <input type="number" value={s.largeExpenseThreshold} onChange={e => setS({...s, largeExpenseThreshold: Number(e.target.value)})} className={`flex-1 bg-transparent font-bold text-xl border-none outline-none`} />
             </div>
           )}
         </div>
         <div className="space-y-5 pt-5">
           <div className="flex justify-between items-center">
             <span className={`font-bold text-base ${t.text}`}>帳單到期提醒</span>
             <ToggleSwitch checked={s.notifyBillDue} onChange={val => setS({...s, notifyBillDue: val, notifyEvents: val})} isDark={isDark} />
           </div>
           <div className="flex justify-between items-center">
             <span className={`font-bold text-base ${t.text}`}>紀念日提前提醒</span>
             <ToggleSwitch checked={s.notifyEvents} onChange={val => setS({...s, notifyEvents: val})} isDark={isDark} />
           </div>
           {s.notifyEvents && (
             <div className={`flex items-center gap-3 ${t.cardInner} p-4 rounded-2xl`}>
               <span className={`text-sm ${t.textM} font-bold px-1`}>提前幾天提醒？</span>
               <input type="number" value={s.notifyAdvanceDays || 3} onChange={e => setS({...s, notifyAdvanceDays: Number(e.target.value)})} className={`w-20 ${t.bg} p-2 rounded-xl font-bold text-lg border-none text-center outline-none`} />
               <span className={`text-sm ${t.textM} font-bold`}>天</span>
             </div>
           )}
         </div>
      </div>

      <button onClick={onRecurring} className={`w-full py-5 rounded-full border ${t.border} ${t.bg} font-bold text-base flex justify-between items-center px-8 ${t.text} shadow-sm active:scale-95`}>
        <div className="flex items-center gap-3"><Repeat className={`w-6 h-6 ${t.textM}`} /> 設定週期性自動記帳</div>
        <ChevronRight className={`w-6 h-6 ${t.textM}`} />
      </button>

      <button onClick={() => onSave(s)} className={`w-full py-6 rounded-full font-bold text-xl text-white mt-3 shadow-lg ${t.primary} active:scale-95`}>
        儲存設定
      </button>
      
      <button onClick={onExport} className={`w-full py-6 rounded-full font-bold text-lg border ${t.border} mt-3 shadow-sm flex items-center justify-center gap-3 text-[#0F9D58] ${t.bg} hover:opacity-80 active:scale-95`}>
        <DownloadCloud className="w-6 h-6"/> 匯出 CSV (可匯入 Google Sheets)
      </button>
    </div>
  );
};

// ==========================================
// 🌟 實體條碼展示 (純淨版，無密碼欄位)
// ==========================================
const BarcodeDisplay = ({ code, t }) => {
  const safeCode = code ? encodeURIComponent(code) : '';
  const barcodeUrl = safeCode ? `https://bwipjs-api.metafloor.com/?bcid=code39&text=${safeCode}&scale=3&height=12&includetext=false` : null;

  return (
    <div className="mb-5">
      <div className={`bg-white border-2 border-stone-200 rounded-3xl p-8 flex flex-col items-center justify-center shadow-sm min-h-[160px]`}>
         {barcodeUrl ? (
           <img src={barcodeUrl} alt="Barcode" className="w-full h-24 object-contain mb-5 mix-blend-multiply" />
         ) : (
           <div className="flex gap-2 h-20 mb-5 w-full justify-center opacity-30">
             {[1,0,1,1,0,1,0,0,1,1,1,0,1,0,1,1,0,0,1,0,1,1].map((v,i) => <div key={i} className={`w-2 h-full ${v ? 'bg-[#2A2623]' : 'bg-transparent'}`}></div>)}
           </div>
         )}
         <span className="font-mono font-black text-3xl text-[#2A2623] tracking-[0.2em]">{code || '尚未設定'}</span>
      </div>
    </div>
  );
};

const BarcodeForm = ({ codes, onSave, t }) => {
  const [tab, setTab] = useState('h');
  const [h, setH] = useState(codes.h || '');  
  const [w, setW] = useState(codes.w || ''); 
  const [mode, setMode] = useState('view'); 
  
  return (
    <div className="space-y-6">
      <div className={`flex ${t.bg} p-2 rounded-2xl`}>
        <button onClick={() => setTab('h')} className={`flex-1 py-3 text-base font-bold rounded-xl transition-colors ${tab === 'h' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>👨 老公</button>
        <button onClick={() => setTab('w')} className={`flex-1 py-3 text-base font-bold rounded-xl transition-colors ${tab === 'w' ? `${t.cardInner} shadow-sm ${t.text}` : t.textM}`}>👩 老婆</button>
      </div>
      
      {mode === 'view' ? (
        <div className={`p-6 rounded-3xl ${t.bg} space-y-5`}>
          <BarcodeDisplay code={tab === 'h' ? h : w} t={t} />
          <button onClick={() => setMode('edit')} className={`w-full py-5 rounded-2xl font-bold text-lg border ${t.border} ${t.cardInner} ${t.text} shadow-sm active:scale-95`}>
            設定 / 修改條碼
          </button>
        </div>
      ) : (
        <div className={`p-6 rounded-3xl ${t.bg} space-y-6`}>
          <div className="space-y-3">
            <label className={`text-sm font-bold ${t.textM} px-2`}>{tab === 'h' ? '老公' : '老婆'} 手機條碼</label>
            <input value={tab === 'h' ? h : w} onChange={e => tab === 'h' ? setH(e.target.value.toUpperCase()) : setW(e.target.value.toUpperCase())} className={`w-full p-5 rounded-2xl uppercase font-mono text-xl font-bold ${t.cardInner} border ${t.border} shadow-sm outline-none focus:ring-2 ${t.ring}`} placeholder="/..." />
          </div>
          <button onClick={() => { onSave(h, w); setMode('view'); }} className={`w-full py-5 rounded-2xl font-bold text-xl text-white shadow-md ${t.primary} mt-3 active:scale-95`}>儲存設定</button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 週期性記帳管理表單
// ==========================================
const RecurringForm = ({ rules, accounts, cats, onSave, onDelete, t }) => {
  const [view, setView] = useState('list');
  const [step, setStep] = useState(1);
  const [r, setR] = useState({ 
    name: '', frequency: 'monthly', interval: 1, 
    txData: { type: 'expense', category: cats.expense[0].name, accountId: accounts[0]?.id||'', amount: '', note: '' } 
  });

  if (view === 'list') {
    return (
      <div className="space-y-6 h-full flex flex-col">
        <button onClick={() => setView('add')} className={`w-full py-5 rounded-3xl border-2 border-dashed ${t.border} ${t.textM} font-bold text-lg flex justify-center items-center gap-3`}>
          + 新增自動記帳規則
        </button>
        <div className="flex-1 overflow-y-auto space-y-5 scrollbar-hide pb-6">
          {rules.length === 0 ? (
            <div className={`text-center py-16 text-base ${t.textM} font-bold border ${t.border} rounded-[2.5rem] ${t.bg}`}>尚無自動記帳規則</div>
          ) : rules.map(rule => (
            <div key={rule.id} className={`p-6 rounded-[2rem] border ${t.border} ${t.cardInner} flex justify-between items-center relative shadow-sm`}>
              <div>
                <h4 className="font-extrabold text-xl">{rule.name}</h4>
                <p className={`text-sm font-bold ${t.textM} mt-2`}>
                  每 {rule.interval} {rule.frequency === 'monthly' ? '個月' : '週'}
                </p>
              </div>
              <div className="text-right pr-10">
                <span className="font-black text-2xl">${rule.txData.amount}</span>
                <p className={`text-sm font-bold ${t.textM} mt-1.5`}>{rule.txData.type === 'transfer' ? '轉帳' : rule.txData.category}</p>
              </div>
              <button onClick={() => onDelete(rule.id)} className={`absolute top-6 right-5 ${t.textM} hover:text-red-500 p-1.5`}>
                <Trash2 className="w-6 h-6" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-4 mb-3">
        <button onClick={() => { setView('list'); setStep(1); }} className={`p-3 rounded-full border ${t.border}`}>
          <ChevronLeft className={`w-6 h-6 ${t.textM}`}/>
        </button>
        <span className="font-bold text-lg">步驟 {step}/3: {step === 1 ? '基本設定' : step === 2 ? '記帳內容' : '確認規則'}</span>
      </div>
      
      {step === 1 && (
        <div className="space-y-8 flex-1">
          <input value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="規則名稱 (如: 每月房租)" className={`w-full p-6 rounded-3xl font-bold text-2xl ${t.bg} border-none outline-none`} />
          <div className="space-y-4">
            <label className={`font-bold text-base ${t.textM} px-2`}>多久發生一次？</label>
            <div className="flex gap-5 items-center">
              <span className="font-bold text-xl px-3">每</span>
              <input type="number" min="1" value={r.interval} onChange={e => setR({ ...r, interval: Number(e.target.value) })} className={`w-28 p-5 rounded-2xl font-bold text-2xl text-center ${t.bg} border-none outline-none`} />
              <div className={`flex p-2 rounded-2xl border ${t.border} ${t.bg} flex-1`}>
                {['monthly:個月', 'weekly:週'].map(i => { 
                  const [k, l] = i.split(':'); 
                  return <button key={k} onClick={() => setR({ ...r, frequency: k })} className={`flex-1 py-4 rounded-xl font-bold text-base transition-all ${r.frequency === k ? `${t.cardInner} shadow-sm ${t.primaryText}` : t.textM}`}>{l}</button> 
                })}
              </div>
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!r.name} className={`w-full py-6 rounded-3xl font-bold text-xl ${t.primary} text-white shadow-md disabled:opacity-50 mt-auto`}>下一步</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 flex-1 flex flex-col">
          <p className={`font-bold text-sm ${t.textM} px-2`}>設定時間到了要自動記下的內容：</p>
          <TxForm 
            accounts={accounts} cats={cats} tags={[]} initialData={null} templates={[]} settings={{}}
            onAI={() => { alert('自動化規則請手動設定內容喔！') }} onAddTag={() => {}} onSaveTemplate={() => {}} onDeleteTemplate={() => {}}
            onSave={(txData) => { setR({ ...r, txData }); setStep(3); }} t={t} ui={{isDark: t.bg.includes('0F')}}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 text-center flex-1 flex flex-col justify-center items-center">
          <Repeat className={`w-24 h-24 mb-4 ${t.textM}`} />
          <h3 className="font-black text-3xl mb-6">確認建立規則？</h3>
          <div className={`p-8 rounded-[2.5rem] border ${t.border} ${t.bg} w-full text-left space-y-5`}>
            <p className="flex justify-between"><span className={`text-base ${t.textM}`}>名稱：</span><span className="font-bold text-xl">{r.name}</span></p>
            <p className="flex justify-between"><span className={`text-base ${t.textM}`}>頻率：</span><span className="font-bold text-xl">每 {r.interval} {r.frequency === 'monthly' ? '個月' : '週'}</span></p>
            <hr className={t.border} />
            <p className="flex justify-between items-center">
              <span className={`text-base ${t.textM}`}>內容：</span>
              <span className="font-black text-3xl">
                {r.txData.type === 'transfer' ? '轉帳' : r.txData.category} ${r.txData.amount}
              </span>
            </p>
          </div>
          <button onClick={() => { onSave({ ...r, nextDueDate: new Date(), createdAt: serverTimestamp() }); setView('list'); }} className={`w-full py-6 rounded-3xl font-black text-xl ${t.primary} text-white shadow-md mt-auto active:scale-95`}>
            確認建立
          </button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 其他基本表單
// ==========================================
const AccForm = ({ onSave, t }) => {
  const [n, setN] = useState(''); const [i, setI] = useState('🏦');
  return (
    <div className="space-y-6">
      <div className="space-y-3"><label className={`text-sm font-bold ${t.textM} px-3`}>帳戶名稱</label><input value={n} onChange={e => setN(e.target.value)} placeholder="例如：中信戶頭" className={`w-full p-5 rounded-2xl font-bold text-base ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} /></div>
      <div className="space-y-3"><label className={`text-sm font-bold ${t.textM} px-3`}>帳戶圖示</label><div className="flex gap-3 text-4xl overflow-x-auto py-3 hide-scrollbar">{['🏦','💳','💼','💎', '🐖', '🪙', '📈', '🏠'].map(x => (<button key={x} onClick={() => setI(x)} className={`p-5 border rounded-3xl shrink-0 transition-all ${i === x ? `${t.primaryText} ${t.bg} border-transparent shadow-sm` : `${t.border} ${t.cardInner}`}`}>{x}</button>))}</div></div>
      <button onClick={() => onSave({name:n, type:'joint', icon:i, balance:0})} disabled={!n} className={`w-full py-5 rounded-full font-bold text-lg text-white shadow-md ${t.primary} disabled:opacity-50 mt-4`}>建立帳戶</button>
    </div>
  );
};

const BillForm = ({ onSave, t }) => {
  const [n, setN] = useState(''); const [a, setA] = useState(''); const [d, setD] = useState(1);
  return (
    <div className="space-y-6">
      <input value={n} onChange={e => setN(e.target.value)} placeholder="帳單名稱 (例如: 手機費)" className={`w-full p-5 rounded-2xl font-bold text-lg ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} />
      <div className="flex gap-4">
        <div className="flex-1 space-y-3"><label className={`text-sm font-bold ${t.textM} px-3`}>金額</label><input type="number" value={a} onChange={e => setA(e.target.value)} placeholder="0" className={`w-full p-5 rounded-2xl font-bold text-lg ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} /></div>
        <div className="flex-1 space-y-3"><label className={`text-sm font-bold ${t.textM} px-3`}>每月幾號繳？</label><input type="number" min="1" max="31" value={d} onChange={e => setD(e.target.value)} className={`w-full p-5 rounded-2xl font-bold text-lg text-center ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} /></div>
      </div>
      <button onClick={() => onSave({name:n, amount:Number(a), dueDate:Number(d), icon:'🧾'})} disabled={!n || !a} className={`w-full py-5 rounded-full font-bold text-lg text-white shadow-md ${t.primary} disabled:opacity-50 mt-4`}>建立帳單</button>
    </div>
  );
};

const NoteForm = ({ data, onSave, onDelete, t }) => {
  const [ti, setTi] = useState(data?.title || ''); const [c, setC] = useState(data?.content || '');
  return (
    <div className={`space-y-5 flex flex-col h-full ${t.bg} p-8 rounded-[2.5rem] border ${t.border} shadow-inner`}>
      <div className={`flex justify-between items-center mb-4 border-b ${t.border} pb-4`}>
        <input value={ti} onChange={e => setTi(e.target.value)} placeholder="標題..." className={`w-full p-2 font-black text-2xl bg-transparent border-none focus:outline-none ${t.text}`} />
        {data && <Trash2 onClick={() => onDelete(data.id)} className={`${t.textM} hover:text-red-500 cursor-pointer w-6 h-6 shrink-0`}/>}
      </div>
      <textarea value={c} onChange={e => setC(e.target.value)} placeholder="內容..." className={`flex-1 w-full p-2 resize-none min-h-[300px] font-bold text-base bg-transparent border-none focus:outline-none ${t.textM}`} />
      <button onClick={() => onSave({id:data?.id, title:ti, content:c})} disabled={!ti && !c} className={`w-full py-5 rounded-full font-bold text-lg text-white shadow-md ${t.primary} disabled:opacity-50 mt-6 active:scale-95`}>儲存筆記</button>
    </div>
  );
};

const EventForm = ({ onSave, t }) => {
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const [ti, setTi] = useState(''); const [d, setD] = useState(today);
  return (
    <div className="space-y-6">
      <input value={ti} onChange={e => setTi(e.target.value)} placeholder="名稱 (例如: 結婚紀念日)" className={`w-full p-5 rounded-2xl font-bold text-lg ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} />
      <input type="date" value={d} onChange={e => setD(e.target.value)} className={`w-full p-5 rounded-2xl font-bold text-lg ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} />
      <button onClick={() => onSave({title:ti, date:d, icon:'🎉'})} disabled={!ti || !d} className={`w-full py-5 rounded-full font-bold text-lg text-white shadow-md bg-pink-500/80 disabled:opacity-50 mt-4`}>新增日子</button>
    </div>
  );
};

const GoalForm = ({ onSave, t }) => {
  const [ti, setTi] = useState(''); const [a, setA] = useState('');
  return (
    <div className="space-y-6">
      <input value={ti} onChange={e => setTi(e.target.value)} placeholder="目標名稱 (例如: 歐洲旅遊)" className={`w-full p-5 rounded-2xl font-bold text-lg ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} />
      <input type="number" value={a} onChange={e => setA(e.target.value)} placeholder="目標金額" className={`w-full p-5 rounded-2xl font-bold text-lg ${t.bg} border-none outline-none focus:ring-2 ${t.ring}`} />
      <button onClick={() => onSave({title:ti, targetAmount:Number(a)})} disabled={!ti || !a} className={`w-full py-5 rounded-full font-bold text-lg text-white shadow-md ${t.primary} disabled:opacity-50 mt-4`}>建立願望</button>
    </div>
  );
};

const FundForm = ({ goal, onSave, t }) => {
  const [a, setA] = useState('');
  return (
    <div className="space-y-8 text-center">
      <p className={`font-bold text-lg ${t.textM} mb-6`}>存入資金到 <span className={`${t.primaryText} ml-2`}>{goal?.title}</span></p>
      <input type="number" value={a} onChange={e => setA(e.target.value)} autoFocus placeholder="$0" className={`w-full py-10 text-center font-black text-[5rem] bg-transparent border-b-2 ${t.border} ${t.text} focus:outline-none focus:border-[#C86D23]`} />
      <button onClick={() => onSave(Number(a))} disabled={!a} className={`w-full py-6 rounded-full font-black text-2xl text-white shadow-md ${t.primary} disabled:opacity-50 mt-10 active:scale-95`}>確認存入</button>
    </div>
  );
};
