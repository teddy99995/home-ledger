import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, X, Heart, Loader2, Trash2, ReceiptText, Sparkles, ChevronLeft, ChevronRight, Target, Coins, 
  PieChart as PieChartIcon, ArrowRightLeft, Home, Search, Settings, CheckCircle2, AlertCircle,
  Calculator, Barcode, Camera, ClipboardList, CheckSquare, StickyNote, Edit3, CalendarHeart,
  Wallet, CalendarClock, Check, Briefcase, ShoppingCart, DownloadCloud, Image as ImageIcon,
  AlertTriangle, ChevronDown, Moon, Sun, Tag, Filter, Wand2, RefreshCw, Keyboard
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// ==========================================
// 核心設定與資料庫初始化 (已綁定您的專屬金鑰)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCegdtoILGfQEQqp7hzK5q--if0hViIOF8",
  authDomain: "our-home-ledger-2254a.firebaseapp.com",
  projectId: "our-home-ledger-2254a",
  storageBucket: "our-home-ledger-2254a.firebasestorage.app",
  messagingSenderId: "862648863577",
  appId: "1:862648863577:web:c72fe356874881ce429a48",
  measurementId: "G-CFH36TJ61W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'our-home-ledger-2254a'; 

// --- 分類與顏色設定 ---
const EXPENSE_CATEGORIES = [
  { id: 'food', name: '餐飲', icon: '🍽️', color: '#D4A373' }, { id: 'shopping', name: '購物', icon: '🛍️', color: '#E9C46A' },
  { id: 'transport', name: '交通', icon: '🚗', color: '#A3B18A' }, { id: 'home', name: '居家', icon: '🏠', color: '#CCD5AE' },
  { id: 'entertainment', name: '娛樂', icon: '🍿', color: '#F4A261' }, { id: 'other_exp', name: '其他', icon: '✨', color: '#EAE0D5' },
];
const STUDIO_EXPENSE_CATEGORIES = [
  { id: 'software', name: '軟體訂閱', icon: '💻', color: '#4F46E5' }, { id: 'equipment', name: '器材', icon: '📷', color: '#6366F1' },
  { id: 'marketing', name: '行銷廣告', icon: '📢', color: '#8B5CF6' }, { id: 'other_studio', name: '雜支', icon: '✨', color: '#C7D2FE' },
];
const INCOME_CATEGORIES = [
  { id: 'salary', name: '薪資', icon: '💰', color: '#A3B18A' }, { id: 'investment', name: '投資', icon: '📈', color: '#D4A373' },
  { id: 'brand', name: '品牌收入', icon: '💼', color: '#F4A261' }, { id: 'other_inc', name: '其他', icon: '✨', color: '#EAE0D5' },
];

const getLocalYYYYMM = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getLocalYYYYMMDD = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const calculateDaysDiff = (targetDateStr) => {
  const target = new Date(targetDateStr); const today = new Date();
  today.setHours(0, 0, 0, 0); target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

export default function App() {
  const [user, setUser] = useState(null);
  
  // --- Firebase Data States ---
  const [allTransactions, setAllTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [notes, setNotes] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [goals, setGoals] = useState([]);
  const [events, setEvents] = useState([]);
  const [globalTags, setGlobalTags] = useState([]); 
  const [appSettings, setAppSettings] = useState({ 
    monthlyBudget: 50000, husbandBarcode: '', wifeBarcode: '', husbandCert: '', wifeCert: '', enableRollover: true, autoSyncInvoices: true 
  });

  // --- UI States ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('home'); 
  const [lifeSubTab, setLifeSubTab] = useState('shopping'); 
  const [statsView, setStatsView] = useState('month'); 
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null); 
  const [modalType, setModalType] = useState(null); 
  const [workspace, setWorkspace] = useState('family'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState([]); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const syncAttempted = useRef(false);

  const showToast = (msg, type = 'success', duration = 3000) => { setToast({ msg, type }); if (duration > 0) setTimeout(() => setToast(null), duration); };

  useEffect(() => {
    const initAuth = async () => { try { await signInAnonymously(auth); } catch (err) { showToast("登入失敗", "error"); } };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); if (!currentUser) setIsLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubTx = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_ledger'), (snap) => {
      const data = []; snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)); setAllTransactions(data); setIsLoading(false);
    });
    const accRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_accounts');
    const unsubAcc = onSnapshot(accRef, (snap) => {
      if (snap.empty) {
        const defaults = [{ id: 'acc_joint', name: '共同生活金', type: 'joint', icon: '🏦' }, { id: 'acc_h_bank', name: '老公帳戶', type: 'husband', icon: '💳' }, { id: 'acc_w_bank', name: '老婆帳戶', type: 'wife', icon: '💳' }, { id: 'acc_studio', name: '品牌工作室', type: 'brand', icon: '💼' }];
        defaults.forEach(d => setDoc(doc(accRef, d.id), { ...d, createdAt: serverTimestamp() }));
      } else {
        const data = []; snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)); setAccounts(data);
      }
    });
    const unsubBills = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_bills'), (snap) => {
      const data = []; snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.dueDate - b.dueDate); setBills(data);
    });
    const unsubNotes = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_notes'), (snap) => {
      const data = []; snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0)); setNotes(data);
    });
    const unsubShopping = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_shopping'), (snap) => {
      const data = []; snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => { if (a.completed === b.completed) return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0); return a.completed ? 1 : -1; }); setShoppingList(data);
    });
    const unsubGoals = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_goals'), (snap) => {
      const data = []; snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)); setGoals(data);
    });
    const unsubEvents = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_events'), (snap) => {
      const data = []; snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => { const dA = calculateDaysDiff(a.date); const dB = calculateDaysDiff(b.date); if (dA >= 0 && dB >= 0) return dA - dB; if (dA < 0 && dB < 0) return dB - dA; return dA >= 0 ? -1 : 1; }); setEvents(data);
    });
    const unsubTags = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_tags', 'main'), (doc) => {
      if (doc.exists()) setGlobalTags(doc.data().tags || []); else setGlobalTags([]);
    });
    const unsubSettings = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_settings', 'main'), (docSnap) => {
      if (docSnap.exists()) setAppSettings({ ...appSettings, ...docSnap.data() });
    });

    return () => { unsubTx(); unsubAcc(); unsubBills(); unsubNotes(); unsubShopping(); unsubGoals(); unsubEvents(); unsubTags(); unsubSettings(); };
  }, [user]);

  const currentMonthStr = getLocalYYYYMM(currentDate);
  const currentYearStr = String(currentDate.getFullYear());

  const calculateStats = (txList) => {
    const s = { totalExpense: 0, totalIncome: 0, categoryData: {}, husbandOwes: 0, wifeOwes: 0, husbandPaidForSettle: 0, wifePaidForSettle: 0 };
    txList.forEach(tx => {
      if (tx.type === 'expense') {
        s.totalExpense += tx.amount; s.categoryData[tx.category] = (s.categoryData[tx.category] || 0) + tx.amount;
        if (tx.payer === 'husband') s.husbandPaidForSettle += tx.amount;
        if (tx.payer === 'wife') s.wifePaidForSettle += tx.amount;
        if (tx.split === 'husband') s.husbandOwes += tx.amount;
        else if (tx.split === 'wife') s.wifeOwes += tx.amount;
        else if (tx.split === 'half') { s.husbandOwes += tx.amount / 2; s.wifeOwes += tx.amount / 2; }
      } else s.totalIncome += tx.amount;
    });
    return s;
  };

  const baseWorkspaceTx = useMemo(() => allTransactions.filter(tx => {
    const isBrandAcc = accounts.find(a => a.id === tx.accountId)?.type === 'brand';
    return workspace === 'family' ? !isBrandAcc : isBrandAcc;
  }), [allTransactions, workspace, accounts]);

  const monthlyTx = useMemo(() => baseWorkspaceTx.filter(tx => tx.month === currentMonthStr), [baseWorkspaceTx, currentMonthStr]);
  const yearlyTx = useMemo(() => baseWorkspaceTx.filter(tx => tx.date.startsWith(currentYearStr)), [baseWorkspaceTx, currentYearStr]);

  const displayedTransactions = useMemo(() => {
    return monthlyTx.filter(tx => {
       const matchQuery = !searchQuery || tx.category.includes(searchQuery) || (tx.note && tx.note.includes(searchQuery));
       const matchTags = filterTags.length === 0 || filterTags.every(tag => tx.tags && tx.tags.includes(tag));
       return matchQuery && matchTags;
    });
  }, [monthlyTx, searchQuery, filterTags]);

  const homeStats = useMemo(() => calculateStats(monthlyTx), [monthlyTx]);
  const tabStats = useMemo(() => calculateStats(statsView === 'month' ? monthlyTx : yearlyTx), [monthlyTx, yearlyTx, statsView]);

  const rolloverData = useMemo(() => {
    if (!appSettings.enableRollover || workspace === 'studio') return { enabled: false, amount: 0, effectiveBudget: appSettings.monthlyBudget };
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevMonthStr = getLocalYYYYMM(prevDate);
    const prevMonthlyTx = baseWorkspaceTx.filter(tx => tx.month === prevMonthStr);
    const prevExpense = prevMonthlyTx.reduce((acc, curr) => curr.type === 'expense' ? acc + curr.amount : acc, 0);
    let rolloverAmount = 0;
    if (prevExpense < appSettings.monthlyBudget && prevMonthlyTx.length > 0) rolloverAmount = appSettings.monthlyBudget - prevExpense;
    return { enabled: true, amount: rolloverAmount, effectiveBudget: appSettings.monthlyBudget + rolloverAmount };
  }, [appSettings.monthlyBudget, appSettings.enableRollover, currentDate, baseWorkspaceTx, workspace]);

  const totalAssets = useMemo(() => { let balance = 0; allTransactions.forEach(tx => { if (tx.type === 'expense') balance -= tx.amount; else balance += tx.amount; }); return balance; }, [allTransactions]);
  const accBalances = useMemo(() => { const balances = {}; accounts.forEach(a => balances[a.id] = 0); allTransactions.forEach(tx => { if (tx.type === 'expense') { if (balances[tx.accountId] !== undefined) balances[tx.accountId] -= tx.amount; } else { if (balances[tx.accountId] !== undefined) balances[tx.accountId] += tx.amount; } }); return balances; }, [allTransactions, accounts]);

  const pieChartData = useMemo(() => {
    const total = tabStats.totalExpense || 1;
    return Object.entries(tabStats.categoryData).map(([name, value]) => {
        const catList = workspace === 'family' ? EXPENSE_CATEGORIES : STUDIO_EXPENSE_CATEGORIES;
        const cat = catList.find(c => c.name === name);
        return { name, value, percentage: Math.round((value / total) * 100), color: cat?.color || '#EAE0D5', icon: cat?.icon || '✨' };
      }).sort((a, b) => b.value - a.value);
  }, [tabStats, workspace]);

  const settlement = useMemo(() => {
    const hBal = tabStats.husbandPaidForSettle - tabStats.husbandOwes; const wBal = tabStats.wifePaidForSettle - tabStats.wifeOwes;
    if (hBal > 0.01) return { who: 'wife', to: 'husband', amount: hBal }; 
    if (wBal > 0.01) return { who: 'husband', to: 'wife', amount: wBal }; 
    return { status: 'settled' };
  }, [tabStats]);

  // Actions
  const handleAddTx = async (newTx) => { try { await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_ledger'), { ...newTx, date: getLocalYYYYMMDD(new Date(currentDate)), month: getLocalYYYYMM(new Date(currentDate)), createdAt: serverTimestamp(), createdBy: user.uid }); setModalType(null); showToast("記帳成功！"); } catch (err) { showToast("網路錯誤", "error"); } };
  const handleDeleteTx = (id) => { setConfirmDialog({ message: '確定要刪除這筆紀錄嗎？', onConfirm: async () => { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_ledger', id)); showToast("紀錄已刪除"); } catch (err) { showToast("刪除失敗", "error"); } setConfirmDialog(null); }}); };
  const handleAddGlobalTag = async (tagName) => { if (!tagName.trim() || globalTags.includes(tagName)) return; try { await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_tags', 'main'), { tags: arrayUnion(tagName) }, { merge: true }); showToast(`標籤 #${tagName} 已建立`); } catch (err) {} };
  const handleDeleteGlobalTag = async (tagName) => { try { await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_tags', 'main'), { tags: arrayRemove(tagName) }, { merge: true }); setFilterTags(filterTags.filter(t => t !== tagName)); showToast(`已刪除標籤`); } catch (err) {} };
  const handleAddAccount = async (accData) => { try { await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_accounts'), { ...accData, createdAt: serverTimestamp() }); setModalType(null); showToast("帳戶已建立！"); } catch (err) {} };
  const handleDeleteAccount = (id) => { setConfirmDialog({ message: '確定要移除此帳戶嗎？(不影響過往明細)', onConfirm: async () => { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_accounts', id)); showToast("帳戶已移除"); } catch (err) { showToast("刪除失敗", "error"); } setConfirmDialog(null); }}); };
  const handleAddBill = async (billData) => { try { await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_bills'), { ...billData, isPaid: false, createdAt: serverTimestamp() }); setModalType(null); showToast("帳單已建立！"); } catch (err) {} };
  const handleDeleteBill = (id) => { setConfirmDialog({ message: '確定要移除此固定帳單嗎？', onConfirm: async () => { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_bills', id)); showToast("帳單已移除"); } catch (err) { showToast("刪除失敗", "error"); } setConfirmDialog(null); }}); };
  const handlePayBill = async (bill) => { try { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_bills', bill.id), { isPaid: true }); const targetAccountId = bill.isStudio ? (accounts.find(a=>a.type==='brand')?.id || 'acc_joint') : 'acc_joint'; handleAddTx({ type: 'expense', amount: bill.amount, category: bill.category, note: `${bill.name} (自動繳納)`, accountId: targetAccountId, who: 'joint' }); } catch (err) {} };
  const handleAddShoppingItem = async (e) => { e.preventDefault(); const text = e.target.itemText.value.trim(); if (!text) return; try { await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_shopping'), { text, completed: false, createdAt: serverTimestamp() }); e.target.reset(); } catch (err) {} };
  const handleToggleShoppingItem = async (id, currentStatus) => { try { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_shopping', id), { completed: !currentStatus }); } catch (err) {} };
  const handleDeleteShoppingItem = async (id) => { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_shopping', id)); } catch (err) {} };
  const handleSaveNote = async (noteData) => { try { if (noteData.id) await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_notes', noteData.id), { title: noteData.title, content: noteData.content, updatedAt: serverTimestamp() }); else await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_notes'), { title: noteData.title, content: noteData.content, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setModalType(null); setSelectedNote(null); showToast("筆記已儲存！"); } catch (err) {} };
  const handleDeleteNote = (id) => { setConfirmDialog({ message: '確定刪除這篇筆記？', onConfirm: async () => { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_notes', id)); setModalType(null); setSelectedNote(null); showToast("筆記已刪除"); } catch (err) { showToast("刪除失敗", "error");} setConfirmDialog(null); }}); };
  const handleAddEvent = async (eventData) => { try { await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_events'), { ...eventData, createdAt: serverTimestamp() }); setModalType(null); showToast("紀念日已新增！"); } catch (err) {} };
  const handleDeleteEvent = (id) => { setConfirmDialog({ message: '確定刪除這個日子？', onConfirm: async () => { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_events', id)); showToast("日子已刪除"); } catch (err) { showToast("刪除失敗", "error");} setConfirmDialog(null); }}); };
  const handleAddGoal = async (goal) => { try { await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'shared_goals'), { ...goal, currentAmount: 0, createdAt: serverTimestamp() }); setModalType(null); showToast("目標已建立！"); } catch (err) {} };
  const handleAddFunds = async (amt) => { try { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_goals', selectedGoal.id), { currentAmount: selectedGoal.currentAmount + amt }); setModalType(null); setSelectedGoal(null); showToast("存入成功！"); } catch (err) {} };
  const handleDeleteGoal = (id) => { setConfirmDialog({ message: '確定要放棄這個存錢目標嗎？', onConfirm: async () => { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_goals', id)); showToast("目標已刪除"); } catch (err) { showToast("刪除失敗", "error");} setConfirmDialog(null); }}); };

  const handleCallAI = async () => {
    setIsAiLoading(true); setAiAnalysis('');
    try {
      const apiKey = ""; // Your API Key
      const topCats = pieChartData.slice(0, 3).map(c => `${c.name}(${c.percentage}%)`).join('、');
      let stext = settlement.status === 'settled' ? "無欠款" : (settlement.who === 'husband' ? `老公需給老婆${Math.round(settlement.amount)}` : `老婆需給老公${Math.round(settlement.amount)}`);
      const timeContext = statsView === 'month' ? '本月' : '本年度';
      const prompt = `夫妻${timeContext}紀錄：支出${tabStats.totalExpense}元，預算${appSettings.monthlyBudget}元。前三花費:${topCats||'無'}。結算:${stext}。請用朋友溫馨語氣給一段50字理財建議(不列點)。`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await res.json();
      setAiAnalysis(data.candidates?.[0]?.content?.parts?.[0]?.text || 'AI 顧問去休息了~');
    } catch (err) { setAiAnalysis('AI 產生失敗，請確認 API 連線'); } finally { setIsAiLoading(false); }
  };
  
  const handleExportToSheets = () => {
    if (allTransactions.length === 0) { showToast("目前沒有資料可以匯出喔！", "error"); return; }
    const BOM = "\uFEFF";
    const headers = ['日期', '類型', '分類', '帳戶', '金額', '付款人(代墊)', '分攤責任', '備註', '標籤'];
    const rows = allTransactions.map(tx => {
      const getRole = (r) => r === 'husband' ? '老公' : r === 'wife' ? '老婆' : r === 'half' ? '平分' : r === 'joint' ? '共同' : '未知';
      const type = tx.type === 'expense' ? '支出' : '收入';
      const accName = accounts.find(a => a.id === tx.accountId)?.name || '未知帳戶';
      const tagsStr = tx.tags ? tx.tags.map(t=>`#${t}`).join(' ') : '';
      return [tx.date, type, tx.category, accName, tx.amount, getRole(tx.payer), tx.type === 'expense' ? getRole(tx.split) : '-', tx.note ? `"${tx.note.replace(/"/g, '""')}"` : '', `"${tagsStr}"`].join(",");
    });
    const csvContent = BOM + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', `家庭帳本匯出_${getLocalYYYYMMDD(new Date())}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("匯出成功！");
  };

  const getTheme = () => {
    if (workspace === 'family') {
      return isDarkMode ? {
        bg: 'bg-stone-950', card: 'from-stone-900 to-stone-800', text: 'text-stone-100', textMuted: 'text-stone-400', 
        primary: 'bg-[#C8A985]', primaryText: 'text-[#C8A985]', border: 'border-stone-800', 
        icon: Heart, iconColor: 'text-[#EAB308] fill-[#EAB308]/20', cardInner: 'bg-stone-900',
        input: 'bg-stone-800 text-white placeholder:text-stone-500 border-stone-700'
      } : {
        bg: 'bg-[#FAF9F6]', card: 'from-white to-[#FAF9F6]', text: 'text-stone-800', textMuted: 'text-stone-500', 
        primary: 'bg-[#5C4033]', primaryText: 'text-[#5C4033]', border: 'border-stone-100', 
        icon: Heart, iconColor: 'text-[#FEF0C7] fill-[#FEF0C7] stroke-[#EAB308]', cardInner: 'bg-white',
        input: 'bg-white text-stone-800 placeholder:text-stone-300 border-stone-100'
      };
    } else {
      return isDarkMode ? {
        bg: 'bg-slate-950', card: 'from-slate-900 to-slate-800', text: 'text-slate-100', textMuted: 'text-slate-400', 
        primary: 'bg-indigo-500', primaryText: 'text-indigo-400', border: 'border-slate-800', 
        icon: Briefcase, iconColor: 'text-indigo-400 fill-indigo-400/20', cardInner: 'bg-slate-900',
        input: 'bg-slate-800 text-white placeholder:text-slate-500 border-slate-700'
      } : {
        bg: 'bg-[#F8FAFC]', card: 'from-white to-[#EEF2FF]', text: 'text-slate-800', textMuted: 'text-slate-500', 
        primary: 'bg-[#4F46E5]', primaryText: 'text-[#4F46E5]', border: 'border-slate-200/50', 
        icon: Briefcase, iconColor: 'text-indigo-400 fill-indigo-100', cardInner: 'bg-white',
        input: 'bg-white text-slate-800 placeholder:text-slate-300 border-slate-100'
      };
    }
  };
  const theme = getTheme();

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} font-sans pb-24 relative max-w-md mx-auto shadow-2xl overflow-hidden transition-colors duration-500`}>
      {/* 🛡️ 全局自訂安全刪除彈窗 */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`${theme.cardInner} rounded-[2rem] p-6 w-full max-w-xs shadow-2xl text-center border ${theme.border}`}>
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7" /></div>
            <h3 className={`text-lg font-bold ${theme.text} mb-2`}>{confirmDialog.message}</h3>
            <p className={`text-sm ${theme.textMuted} mb-6`}>此動作無法復原，請確認。</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)} className={`flex-1 py-3.5 rounded-xl font-bold ${theme.textMuted} bg-black/5 active:scale-95 transition-all`}>取消</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-500 active:scale-95 transition-all shadow-md shadow-red-500/20">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-top-4 fade-in duration-300"><div className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg border ${theme.cardInner} ${theme.border} ${theme.text}`}><CheckCircle2 className="w-5 h-5 text-green-500" /><span className="font-medium text-sm">{toast.msg}</span></div></div>}
      
      <header className={`px-6 pt-10 pb-2 flex justify-between items-center ${theme.bg} z-10 relative transition-colors duration-500`}>
        <div className="flex gap-2">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 ${theme.cardInner} rounded-full shadow-sm border ${theme.border} hover:opacity-80 transition-opacity`}>
             {isDarkMode ? <Sun className={`w-5 h-5 ${theme.text}`} /> : <Moon className={`w-5 h-5 ${theme.text}`} />}
           </button>
           <button onClick={() => setModalType('settings')} className={`p-2 ${theme.text} ${theme.cardInner} rounded-full shadow-sm border ${theme.border} hover:opacity-80 transition-colors`}><Settings className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <div className={`flex ${theme.cardInner} backdrop-blur-md p-1 rounded-full border ${theme.border} mb-2 shadow-sm`}>
             <button onClick={() => setWorkspace('family')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 ${workspace === 'family' ? `${theme.text} bg-black/5` : `${theme.textMuted} hover:text-opacity-80`} `}><Home className="w-3 h-3" /> 家庭</button>
             <button onClick={() => setWorkspace('studio')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 ${workspace === 'studio' ? `${theme.text} bg-black/5` : `${theme.textMuted} hover:text-opacity-80`} `}><Briefcase className="w-3 h-3" /> 工作室</button>
          </div>
          <h1 className="text-xl font-bold flex items-center justify-center gap-2 tracking-tight">
            {workspace === 'family' ? 'Home Ledger' : 'Studio Ledger'} <theme.icon className={`w-5 h-5 ${theme.iconColor}`} />
          </h1>
        </div>
        <button onClick={() => setModalType('barcode')} className={`p-2 ${theme.text} ${theme.cardInner} rounded-full shadow-sm border ${theme.border} hover:opacity-80 transition-colors`}><Barcode className="w-5 h-5" /></button>
      </header>

      <main className="px-5 space-y-6 mt-2 h-[calc(100vh-190px)] overflow-y-auto pb-32 hide-scrollbar">
        {/* === 🏠 首頁 === */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className={`bg-gradient-to-br ${theme.card} rounded-[2rem] p-6 shadow-sm border ${theme.border} relative transition-colors duration-500`}>
              <div className="flex justify-between items-center mb-2">
                 <button onClick={() => setModalType('datePicker')} className={`flex items-center gap-1 text-sm font-bold ${theme.textMuted} hover:${theme.text} transition-colors bg-black/5 px-3 py-1.5 rounded-xl`}>
                   {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月 <ChevronDown className="w-3 h-3" />
                 </button>
                 <span className={`text-sm font-medium ${theme.textMuted}`}>{workspace === 'family' ? '總支出' : '總開銷'}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-4"><span className={`text-2xl font-semibold ${theme.textMuted}`}>$</span><h2 className="text-5xl font-bold tracking-tight">{homeStats.totalExpense.toLocaleString()}</h2></div>
              
              {rolloverData.enabled && (
                <div className={`mt-4 ${theme.cardInner} rounded-xl p-3 border ${theme.border} text-xs font-medium`}>
                   <div className="flex items-center gap-1.5 mb-1.5"><Sparkles className={`w-4 h-4 ${theme.primaryText}`}/> <span className={theme.text}>上月預算結轉機制</span></div>
                   <div className="flex justify-between items-center">
                     <span className={theme.textMuted}>上月省下：<strong className="text-emerald-500">${rolloverData.amount.toLocaleString()}</strong></span>
                     <span className={theme.textMuted}>本月可用：<strong className={theme.text}>${rolloverData.effectiveBudget.toLocaleString()}</strong></span>
                   </div>
                   <div className="w-full h-1.5 bg-black/5 rounded-full mt-2 overflow-hidden">
                     <div className={`h-full ${theme.primary} rounded-full`} style={{width: `${Math.min((homeStats.totalExpense/rolloverData.effectiveBudget)*100, 100)}%`}}></div>
                   </div>
                </div>
              )}
            </section>

            <div className="space-y-3">
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className={`w-4 h-4 ${theme.textMuted} absolute left-4 top-1/2 -translate-y-1/2`} />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜尋紀錄、備註..." className={`w-full ${theme.input} text-sm py-3.5 pl-11 pr-4 rounded-2xl shadow-sm focus:outline-none focus:ring-2 ring-black/5 transition-all`} />
                </div>
                <button onClick={() => setModalType('filterTags')} className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center ${filterTags.length > 0 ? `${theme.primary} text-white border-transparent shadow-md` : `${theme.cardInner} ${theme.textMuted} ${theme.border}`}`}>
                  <Filter className="w-5 h-5" />
                  {filterTags.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">{filterTags.length}</span>}
                </button>
              </div>
              {filterTags.length > 0 && (
                <div className="flex gap-2 flex-wrap px-1">
                  {filterTags.map(tag => (
                    <span key={tag} onClick={() => setFilterTags(filterTags.filter(t=>t!==tag))} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1 ${theme.primaryText} bg-black/5 hover:bg-red-500 hover:text-white transition-colors`}>#{tag} <X className="w-3 h-3"/></span>
                  ))}
                </div>
              )}
            </div>
            
            <section>
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-base font-bold">最近明細</h3>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className={`p-1.5 ${theme.cardInner} rounded-full ${theme.textMuted} border ${theme.border}`}><ChevronLeft className="w-4 h-4"/></button>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className={`p-1.5 ${theme.cardInner} rounded-full ${theme.textMuted} border ${theme.border}`}><ChevronRight className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="space-y-2.5">
                {isLoading ? (<div className="py-10 text-center"><Loader2 className={`w-6 h-6 animate-spin ${theme.textMuted} mx-auto`} /></div>) : displayedTransactions.length === 0 ? (<div className={`text-center py-10 ${theme.textMuted} text-sm ${theme.cardInner} rounded-[1.5rem] border ${theme.border}`}>無符合條件的紀錄</div>) : displayedTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense'; const acc = accounts.find(a => a.id === tx.accountId);
                  const catList = workspace === 'family' ? EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES) : STUDIO_EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES);
                  const catIcon = catList.find(c=>c.name===tx.category)?.icon || '📝';
                  
                  return (
                    <div key={tx.id} className={`group ${theme.cardInner} p-3.5 rounded-[1.5rem] flex items-center justify-between border ${theme.border} shadow-sm relative overflow-hidden`}>
                      <div className="flex items-center gap-3 overflow-hidden w-full pr-8">
                        <div className="relative">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 bg-black/5`}>{catIcon}</div>
                          {tx.hasPhoto && <div className={`absolute -bottom-1 -right-1 ${theme.bg} p-0.5 rounded-full shadow-sm`}><ImageIcon className={`w-3 h-3 ${theme.primaryText}`} /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold text-sm truncate ${theme.text}`}>
                            {tx.category} <span className={`text-[10px] font-medium ${theme.textMuted} ml-1`}>({acc?.name})</span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 overflow-hidden flex-wrap">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md shrink-0 font-bold ${tx.payer==='husband'?'bg-[#EAE0D5] text-[#6B4E31]':tx.payer==='wife'?'bg-[#FEF0C7] text-[#B57C00]':'bg-stone-200 text-stone-600'}`}>付: {tx.payer==='husband'?'老公':tx.payer==='wife'?'老婆':'共同'}</span>
                              {isExpense && tx.split && tx.split !== tx.payer && tx.payer !== 'joint' && (<span className={`text-[9px] px-1.5 py-0.5 rounded-md shrink-0 font-bold border border-stone-300 text-stone-600 bg-white`}>責: {tx.split==='husband'?'老公':tx.split==='wife'?'老婆':'平分'}</span>)}
                              {tx.tags && tx.tags.map(t => <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-black/5 ${theme.textMuted}`}>#{t}</span>)}
                              <span className={`text-[11px] ${theme.textMuted} truncate max-w-[80px]`}>{tx.note}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`flex flex-col items-end shrink-0 ml-2 z-10 ${theme.cardInner} pl-2`}>
                        <span className={`font-black text-[15px] ${isExpense ? theme.text : 'text-emerald-500'}`}>{isExpense ? '-' : '+'}${tx.amount.toLocaleString()}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTx(tx.id); }} className={`absolute right-4 p-2 ${theme.textMuted} hover:text-red-500 ${theme.bg} rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* === 🏦 總資產與帳戶 === */}
        {activeTab === 'wallets' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center px-1 mb-2">
              <h2 className="text-xl font-bold">總資產與帳戶</h2>
              <span className={`text-lg font-black ${theme.primaryText}`}>${totalAssets.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {accounts.map(acc => {
                const isBrand = acc.type === 'brand';
                const accStyle = isBrand ? 'bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20 text-indigo-500' : `${theme.cardInner} ${theme.border} ${theme.text}`;
                return (
                  <div key={acc.id} className={`p-4 rounded-3xl border shadow-sm relative group ${accStyle}`}>
                    <div className="flex items-center gap-2 mb-3 pr-6">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${isBrand ? 'bg-indigo-500/20' : 'bg-black/5'}`}>{acc.icon}</div>
                      <span className={`text-xs font-bold line-clamp-1 opacity-80`}>{acc.name}</span>
                    </div>
                    <div className="text-xl font-black">${(accBalances[acc.id] || 0).toLocaleString()}</div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc.id); }} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4"/></button>
                  </div>
                )
              })}
              <div onClick={() => setModalType('addAccount')} className={`${theme.bg} border-2 border-dashed ${theme.border} rounded-3xl p-4 flex flex-col items-center justify-center ${theme.textMuted} cursor-pointer min-h-[100px] hover:opacity-80 transition-opacity`}>
                 <Plus className="w-6 h-6 mb-1" /><span className="text-xs font-bold">新增帳戶</span>
              </div>
            </div>
          </div>
        )}

        {/* === 📊 統計與 AI === */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className={`flex ${theme.cardInner} p-1.5 rounded-2xl border ${theme.border} shadow-sm mx-1 mb-2`}>
                <button onClick={() => setStatsView('month')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${statsView === 'month' ? `bg-black/5 ${theme.text} shadow-sm` : theme.textMuted}`}>當月分析</button>
                <button onClick={() => setStatsView('year')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${statsView === 'year' ? `bg-black/5 ${theme.text} shadow-sm` : theme.textMuted}`}>年度總結</button>
             </div>

             <div className="flex justify-between items-center px-1 mb-2">
                 <button onClick={() => setModalType('datePicker')} className={`flex items-center gap-1 text-sm font-bold ${theme.text} hover:opacity-80 transition-opacity ${theme.cardInner} px-3 py-1.5 rounded-xl border ${theme.border}`}>
                   {statsView === 'month' ? `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月` : `${currentDate.getFullYear()}年度`} <ChevronDown className="w-4 h-4" />
                 </button>
                 <span className="text-xl font-black">${tabStats.totalExpense.toLocaleString()}</span>
             </div>

             <div className={`${theme.cardInner} rounded-[2rem] p-5 border ${theme.border}`}>
              <div className="flex items-center gap-2 mb-4"><div className={`p-2 bg-black/5 rounded-xl`}><ArrowRightLeft className={`w-5 h-5 ${theme.text}`} /></div><h3 className="font-bold">{statsView === 'month' ? '本月' : '本年度'}代墊結算</h3></div>
              {settlement.status === 'settled' ? (
                <div className={`rounded-xl p-4 text-center border shadow-sm text-emerald-500 font-bold text-sm bg-emerald-500/10 border-emerald-500/20`}>🎉 帳目完全算清！</div>
              ) : (
                <div className={`flex items-center justify-between ${theme.bg} rounded-xl p-4 shadow-inner border ${theme.border}`}>
                  <div className="flex flex-col items-center gap-1"><div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${settlement.who === 'husband' ? 'bg-[#EAE0D5]' : 'bg-[#FEF0C7]'}`}>{settlement.who === 'husband' ? '👨' : '👩'}</div><span className={`text-xs font-bold ${theme.textMuted}`}>{settlement.who === 'husband' ? '老公' : '老婆'}</span></div>
                  <div className="flex flex-col items-center flex-1 px-2"><span className={`text-[10px] ${theme.textMuted} font-bold mb-1`}>需轉帳給</span><div className={`w-full h-[2px] bg-black/10 relative rounded-full`}><div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 bg-black/20 rotate-45 transform origin-bottom-left"></div></div><span className="text-lg font-black text-rose-500 mt-1">${Math.round(settlement.amount).toLocaleString()}</span></div>
                  <div className="flex flex-col items-center gap-1"><div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${settlement.to === 'husband' ? 'bg-[#EAE0D5]' : 'bg-[#FEF0C7]'}`}>{settlement.to === 'husband' ? '👨' : '👩'}</div><span className={`text-xs font-bold ${theme.textMuted}`}>{settlement.to === 'husband' ? '老公' : '老婆'}</span></div>
                </div>
              )}
            </div>
            
            <div className={`${theme.cardInner} rounded-[2rem] p-6 shadow-sm border ${theme.border} flex flex-col items-center`}>
                <div className={`relative w-48 h-48 rounded-full mb-6 border-[6px] ${isDarkMode ? 'border-stone-800' : 'border-white'} shadow-sm`} style={{ background: `conic-gradient(${pieChartData.map((s,i,arr) => { let start = arr.slice(0,i).reduce((acc,c)=>acc+c.percentage,0); return `${s.color} ${start}% ${start+s.percentage}%` }).join(', ')})` }}><div className={`absolute inset-0 m-auto w-32 h-32 ${theme.cardInner} rounded-full flex flex-col items-center justify-center shadow-inner`}><span className={`text-xs ${theme.textMuted} font-bold`}>總支出</span><span className="text-xl font-black">${tabStats.totalExpense.toLocaleString()}</span></div></div>
                <div className="w-full space-y-2.5">
                  {pieChartData.length === 0 ? <p className={`text-center ${theme.textMuted} text-sm font-bold`}>無支出資料</p> : pieChartData.map((item, idx) => (
                    <div key={idx} className={`flex items-center justify-between text-sm ${theme.bg} p-2.5 rounded-xl`}><div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span><span className={`font-bold ${theme.text}`}>{item.icon} {item.name}</span></div><div className="flex items-center gap-3"><span className={`font-bold ${theme.textMuted} text-xs`}>{item.percentage}%</span><span className="font-black">${item.value.toLocaleString()}</span></div></div>
                  ))}
                </div>
            </div>

            <div className={`bg-gradient-to-br from-indigo-500/10 to-transparent rounded-[2rem] p-5 border border-indigo-500/20`}>
              <div className="flex items-center gap-2 mb-3"><Sparkles className="w-5 h-5 text-indigo-500" /><h3 className="font-bold text-indigo-500">專屬 AI 財務顧問</h3></div>
              {aiAnalysis ? (<p className={`text-sm leading-relaxed font-bold ${theme.cardInner} p-4 rounded-xl shadow-sm ${theme.text}`}>{aiAnalysis}</p>) : (<button onClick={handleCallAI} disabled={isAiLoading || pieChartData.length===0} className={`w-full ${theme.cardInner} py-3.5 rounded-xl font-bold text-sm shadow-sm border border-indigo-500/20 hover:border-indigo-500 transition-all disabled:opacity-50 text-indigo-500`}>{isAiLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '💡 生成專屬理財建議'}</button>)}
            </div>
          </div>
        )}

        {/* === 🌟 生活 (帳單/購物/記事/紀念日) === */}
        {activeTab === 'life' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className={`flex ${theme.cardInner} p-1.5 rounded-2xl border ${theme.border} shadow-sm mx-1 overflow-x-auto hide-scrollbar`}>
                <button onClick={() => setLifeSubTab('bills')} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${lifeSubTab === 'bills' ? `bg-black/5 ${theme.text} shadow-sm` : theme.textMuted}`}><CalendarClock className="w-4 h-4" /> 帳單</button>
                <button onClick={() => setLifeSubTab('shopping')} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${lifeSubTab === 'shopping' ? `bg-black/5 ${theme.text} shadow-sm` : theme.textMuted}`}><ShoppingCart className="w-4 h-4" /> 購物</button>
                <button onClick={() => setLifeSubTab('notes')} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${lifeSubTab === 'notes' ? `bg-black/5 ${theme.text} shadow-sm` : theme.textMuted}`}><StickyNote className="w-4 h-4" /> 記事</button>
                <button onClick={() => setLifeSubTab('events')} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${lifeSubTab === 'events' ? `bg-black/5 ${theme.text} shadow-sm` : theme.textMuted}`}><CalendarHeart className="w-4 h-4" /> 日子</button>
             </div>

             {lifeSubTab === 'bills' && (
               <div className="animate-in fade-in duration-300 mx-1 space-y-3">
                 <div className="flex justify-between items-end mb-4">
                   <div><h3 className="font-bold">每月固定帳單</h3><p className={`text-xs ${theme.textMuted} mt-1`}>時間到自動提醒繳費</p></div>
                   <button onClick={() => setModalType('addBill')} className={`text-[10px] font-bold ${theme.cardInner} border ${theme.border} px-3 py-1.5 rounded-full ${theme.text} transition-colors`}>+ 新增帳單</button>
                 </div>
                 {bills.length === 0 ? (<div className={`text-center py-20 ${theme.textMuted} text-sm ${theme.cardInner} rounded-3xl border ${theme.border} shadow-sm font-bold`}>沒有固定帳單</div>) : bills.map(bill => {
                   const isUrgent = bill.dueDate - currentDate.getDate() <= 3 && !bill.isPaid;
                   return (
                     <div key={bill.id} className={`p-4 rounded-[1.5rem] border shadow-sm transition-all relative group ${bill.isPaid ? `${theme.bg} border-transparent opacity-60` : isUrgent ? 'bg-rose-500/10 border-rose-500/30' : `${theme.cardInner} ${theme.border}`}`}>
                       <div className="flex justify-between items-center pr-6">
                         <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full ${theme.bg} shadow-sm flex items-center justify-center text-lg`}>{bill.icon}</div>
                           <div>
                             <h4 className={`font-bold text-sm ${bill.isPaid ? 'line-through opacity-50' : ''}`}>{bill.name} {bill.isStudio && <span className="ml-1 text-[8px] bg-indigo-500/20 text-indigo-500 px-1.5 py-0.5 rounded-md">工作室</span>}</h4>
                             <p className={`text-[10px] font-bold mt-0.5 ${bill.isPaid ? theme.textMuted : isUrgent ? 'text-rose-500' : theme.textMuted}`}>{bill.isPaid ? '已繳納' : `每月 ${bill.dueDate} 日`}</p>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <span className={`font-black ${bill.isPaid ? theme.textMuted : ''}`}>${bill.amount.toLocaleString()}</span>
                           {!bill.isPaid ? (
                             <button onClick={() => handlePayBill(bill)} className={`w-8 h-8 rounded-full ${theme.primary} text-white flex items-center justify-center shadow-md active:scale-90`}><Check className="w-4 h-4" /></button>
                           ) : (
                             <div className={`w-8 h-8 rounded-full ${theme.bg} ${theme.textMuted} flex items-center justify-center`}><CheckCircle2 className="w-5 h-5" /></div>
                           )}
                         </div>
                       </div>
                       <button onClick={(e) => { e.stopPropagation(); handleDeleteBill(bill.id); }} className={`absolute -top-2 -right-2 w-8 h-8 ${theme.cardInner} border ${theme.border} rounded-full text-red-500 flex items-center justify-center shadow-sm z-10 hover:bg-red-500 hover:text-white transition-colors`}>
                           <X className="w-4 h-4"/>
                       </button>
                     </div>
                   )
                 })}
               </div>
             )}

             {lifeSubTab === 'shopping' && (
               <div className="animate-in fade-in duration-300 mx-1">
                 <form onSubmit={handleAddShoppingItem} className="flex gap-2 mb-4">
                   <input type="text" name="itemText" placeholder="新增待買物品..." className={`flex-1 ${theme.input} shadow-sm rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 ring-black/10`} />
                   <button type="submit" className={`px-4 rounded-xl font-bold text-white shadow-sm active:scale-95 ${theme.primary}`}><Plus className="w-5 h-5"/></button>
                 </form>
                 <div className={`${theme.cardInner} rounded-3xl p-2 shadow-sm border ${theme.border} min-h-[300px]`}>
                   {shoppingList.length === 0 ? (
                     <div className={`text-center py-20 ${theme.textMuted} text-sm font-bold`}>購物清單空空如也！</div>
                   ) : (
                     <div className="space-y-1">
                       {shoppingList.map(item => (
                         <div key={item.id} className={`group flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 transition-colors`}>
                           <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => handleToggleShoppingItem(item.id, item.completed)}>
                             <button className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-400 text-transparent hover:border-emerald-400'}`}><CheckCircle2 className="w-4 h-4" /></button>
                             <span className={`text-sm font-bold transition-all ${item.completed ? `${theme.textMuted} line-through` : theme.text}`}>{item.text}</span>
                           </div>
                           <button onClick={() => handleDeleteShoppingItem(item.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
             )}

             {lifeSubTab === 'notes' && (
               <div className="animate-in fade-in duration-300 mx-1 relative min-h-[400px]">
                 <div className="grid grid-cols-2 gap-3 pb-20">
                   <div onClick={() => { setSelectedNote(null); setModalType('noteEditor'); }} className={`${theme.bg} border-2 border-dashed ${theme.border} rounded-3xl p-4 flex flex-col items-center justify-center ${theme.textMuted} cursor-pointer hover:opacity-80 transition-opacity min-h-[160px]`}><Plus className="w-8 h-8 mb-2" /><span className="text-sm font-bold">新增筆記</span></div>
                   {notes.map(note => ( <div key={note.id} onClick={() => { setSelectedNote(note); setModalType('noteEditor'); }} className="bg-[#FEF0C7] text-stone-800 rounded-3xl p-5 shadow-sm border border-[#E9C46A]/50 cursor-pointer hover:shadow-md transition-all relative group min-h-[160px] flex flex-col"><h4 className="font-bold text-sm mb-2 line-clamp-2">{note.title}</h4><p className="text-xs text-stone-700/80 line-clamp-4 leading-relaxed whitespace-pre-wrap flex-1 font-medium">{note.content}</p><Edit3 className="w-4 h-4 text-[#B57C00] absolute bottom-4 right-4 opacity-50 group-hover:opacity-100 transition-opacity" /></div> ))}
                 </div>
               </div>
             )}

             {lifeSubTab === 'events' && (
               <div className="animate-in fade-in duration-300 mx-1 space-y-3">
                 <div className="flex justify-between items-end mb-4">
                   <div><h3 className="font-bold">重要日子倒數</h3><p className={`text-xs ${theme.textMuted} mt-1`}>紀念日與行程</p></div>
                   <button onClick={() => setModalType('addEvent')} className={`text-[10px] font-bold text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-full hover:bg-rose-500/20 transition-colors`}>+ 新增日子</button>
                 </div>
                 {events.length === 0 ? ( <div className={`text-center py-20 ${theme.textMuted} text-sm font-bold ${theme.cardInner} rounded-3xl border ${theme.border} shadow-sm`}>還沒有設定重要的日子喔！</div> ) : events.map(event => {
                   const daysDiff = calculateDaysDiff(event.date); const isFuture = daysDiff > 0; const isToday = daysDiff === 0;
                   return (
                     <div key={event.id} className={`group relative overflow-hidden rounded-3xl p-5 shadow-sm border transition-all hover:shadow-md ${isToday ? 'bg-gradient-to-br from-rose-500/20 to-pink-500/10 border-rose-500/30' : `${theme.cardInner} ${theme.border}`}`}>
                       <div className="flex justify-between items-start pr-8">
                         <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${isToday ? 'bg-white/50 text-rose-600' : `${theme.bg}`}`}>{event.icon || '🎉'}</div>
                           <div><h4 className={`font-bold text-sm ${isToday ? 'text-rose-600' : ''}`}>{event.title}</h4><p className={`text-[10px] mt-0.5 font-bold ${isToday ? 'text-rose-500' : theme.textMuted}`}>{event.date}</p></div>
                         </div>
                         <div className="flex flex-col items-end">
                           {isToday ? (<span className="text-xl font-black text-rose-500 animate-pulse">就是今天！</span>) : (<div className="flex items-baseline gap-1"><span className={`text-xs font-bold ${theme.textMuted}`}>{isFuture ? '還有' : '已經'}</span><span className={`text-3xl font-black ${isFuture ? theme.primaryText : 'text-stone-500'}`}>{Math.abs(daysDiff)}</span><span className={`text-xs font-bold ${theme.textMuted}`}>天</span></div>)}
                         </div>
                       </div>
                       <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }} className={`absolute top-4 right-4 p-2 text-red-400 hover:bg-red-500/10 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-colors z-10`}><Trash2 className="w-4 h-4" /></button>
                     </div>
                   )
                 })}
               </div>
             )}
          </div>
        )}

        {/* === 🎯 目標 === */}
        {activeTab === 'goals' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex justify-between items-center px-1 mb-2"><h2 className="text-xl font-bold">夢想撲滿</h2><button onClick={() => setModalType('goal')} className={`text-sm font-bold ${theme.cardInner} border ${theme.border} px-4 py-1.5 rounded-full transition-colors`}>+ 新增願望</button></div>
             <div className="grid grid-cols-1 gap-4">
              {goals.length === 0 ? ( <div className={`${theme.cardInner} p-8 rounded-[2rem] border ${theme.border} text-center shadow-sm font-bold`}><Target className={`w-12 h-12 ${theme.textMuted} mx-auto mb-3`} /><p className={theme.textMuted}>還沒有設定存錢目標喔！</p></div>) : goals.map(goal => {
                const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100); const isCompleted = progress >= 100;
                return (
                  <div key={goal.id} className={`group ${theme.cardInner} p-5 rounded-[2rem] border ${theme.border} shadow-sm relative overflow-hidden`}>
                    <div className="flex justify-between items-center mb-3 pr-8"><div className="font-bold text-lg flex items-center gap-2">{isCompleted ? '🎉' : '🎯'} {goal.title}</div><div className={`text-xs font-bold ${theme.textMuted} bg-black/5 px-2.5 py-1 rounded-md`}>{progress.toFixed(0)}%</div></div>
                    <div className="flex justify-between items-end mb-2"><span className="text-2xl font-black">${goal.currentAmount.toLocaleString()}</span><span className={`text-xs font-bold ${theme.textMuted} mb-1`}>/ ${goal.targetAmount.toLocaleString()}</span></div>
                    <div className={`h-3 w-full ${theme.bg} rounded-full overflow-hidden mb-4`}><div className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : theme.primary}`} style={{ width: `${progress}%` }}></div></div>
                    {!isCompleted && (<button onClick={() => { setSelectedGoal(goal); setModalType('addFunds'); }} className={`w-full py-3 ${theme.bg} font-bold rounded-xl hover:opacity-80 flex items-center justify-center gap-2 active:scale-95 transition-transform`}><Coins className={`w-4 h-4 ${theme.primaryText}`} /> 存入資金</button>)}
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }} className="absolute top-4 right-4 p-2 text-red-400 hover:bg-red-500/10 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-colors z-10"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )
              })}
             </div>
          </div>
        )}
      </main>

      {/* === 底部導航列 === */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none">
          <button onClick={() => setModalType('transaction')} className={`pointer-events-auto h-16 w-16 ${theme.primary} text-white rounded-full flex items-center justify-center shadow-xl transition-all duration-500 active:scale-90 border-4 ${isDarkMode ? 'border-stone-900' : 'border-white'}`}>
             <Plus className="w-8 h-8" />
          </button>
        </div>
        <nav className={`${isDarkMode ? 'bg-stone-900/95' : 'bg-white/95'} backdrop-blur-xl border-t ${theme.border} px-6 pb-safe pt-2 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] h-[76px] transition-colors duration-500`}>
          <div className="flex gap-7">
            <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? theme.primaryText : theme.textMuted}`}><Home className="w-6 h-6" /><span className="text-[10px] font-bold">首頁</span></button>
            <button onClick={() => setActiveTab('wallets')} className={`flex flex-col items-center gap-1 ${activeTab === 'wallets' ? theme.primaryText : theme.textMuted}`}><Wallet className="w-6 h-6" /><span className="text-[10px] font-bold">帳戶</span></button>
          </div>
          <div className="w-16"></div>
          <div className="flex gap-7">
            <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 ${activeTab === 'stats' ? theme.primaryText : theme.textMuted}`}><PieChartIcon className="w-6 h-6" /><span className="text-[10px] font-bold">統計</span></button>
            <button onClick={() => setActiveTab('life')} className={`flex flex-col items-center gap-1 ${activeTab === 'life' ? theme.primaryText : theme.textMuted}`}><ClipboardList className="w-6 h-6" /><span className="text-[10px] font-bold">生活</span></button>
          </div>
        </nav>
      </div>

      {/* === 所有 Modals === */}
      {modalType === 'transaction' && <TransactionModal accounts={accounts} workspace={workspace} globalTags={globalTags} onAddGlobalTag={handleAddGlobalTag} onClose={() => setModalType(null)} onSave={handleAddTx} theme={theme} onShowToast={showToast} />}
      {modalType === 'addAccount' && <AddAccountModal onClose={() => setModalType(null)} onSave={handleAddAccount} theme={theme} />}
      {modalType === 'addBill' && <AddBillModal onClose={() => setModalType(null)} onSave={handleAddBill} theme={theme} />}
      {modalType === 'noteEditor' && <NoteEditorModal onClose={() => {setModalType(null); setSelectedNote(null);}} onSave={handleSaveNote} onDelete={handleDeleteNote} initialData={selectedNote} theme={theme} />}
      {modalType === 'addEvent' && <AddEventModal onClose={() => setModalType(null)} onSave={handleAddEvent} theme={theme} />}
      {modalType === 'goal' && <AddGoalModal onClose={() => setModalType(null)} onSave={handleAddGoal} theme={theme} />}
      {modalType === 'addFunds' && <AddFundsModal onClose={() => {setModalType(null); setSelectedGoal(null);}} onSave={handleAddFunds} goalName={selectedGoal?.title} theme={theme} />}
      {modalType === 'settings' && <SettingsModal onClose={() => setModalType(null)} settings={appSettings} onSave={(s) => { setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_settings', 'main'), s, { merge: true }); showToast("設定已儲存！"); setModalType(null); }} onExport={handleExportToSheets} theme={theme} />}
      {modalType === 'barcode' && <BarcodeModal onClose={() => setModalType(null)} barcodes={{husbandBarcode: appSettings.husbandBarcode, wifeBarcode: appSettings.wifeBarcode, husbandCert: appSettings.husbandCert, wifeCert: appSettings.wifeCert}} onSaveSettings={(h,w, hc, wc) => {setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shared_settings', 'main'), { husbandBarcode: h, wifeBarcode: w, husbandCert: hc, wifeCert: wc }, { merge: true }); showToast("載具設定已儲存！"); }} onAddTx={handleAddTx} onShowToast={showToast} theme={theme} activeWorkspace={workspace} />}
      {modalType === 'datePicker' && <DatePickerModal onClose={() => setModalType(null)} currentDate={currentDate} onSelect={(newDate) => {setCurrentDate(newDate); setModalType(null);}} theme={theme} />}
      {modalType === 'filterTags' && <FilterTagsModal onClose={() => setModalType(null)} globalTags={globalTags} filterTags={filterTags} setFilterTags={setFilterTags} onDeleteTag={handleDeleteGlobalTag} theme={theme} />}
    </div>
  );
}

// ==========================================
// Modals 
// ==========================================

function FilterTagsModal({ onClose, globalTags, filterTags, setFilterTags, onDeleteTag, theme }) {
  const toggleTag = (tag) => {
    if (filterTags.includes(tag)) setFilterTags(filterTags.filter(t => t !== tag));
    else setFilterTags([...filterTags, tag]);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-sm ${theme.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-safe shadow-2xl border ${theme.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-bold text-lg ${theme.text} flex items-center gap-2`}><Filter className="w-5 h-5"/> 篩選特定標籤</h3>
          <button onClick={onClose} className={`p-2 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          {globalTags.length === 0 ? <p className={`text-sm ${theme.textMuted} font-bold w-full text-center py-4`}>尚未建立任何標籤</p> : globalTags.map(tag => {
            const isSelected = filterTags.includes(tag);
            return (
              <div key={tag} className="relative group">
                <button onClick={() => toggleTag(tag)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${isSelected ? `${theme.primary} text-white border-transparent` : `${theme.bg} ${theme.text} ${theme.border}`}`}>
                  #{tag}
                </button>
                <button onClick={() => onDeleteTag(tag)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
              </div>
            )
          })}
        </div>
        <button onClick={() => setFilterTags([])} className={`w-full py-3.5 rounded-xl font-bold ${theme.textMuted} ${theme.bg} active:scale-95`}>清除所有篩選</button>
      </div>
    </div>
  )
}

function DatePickerModal({ onClose, currentDate, onSelect, theme }) {
  const [year, setYear] = useState(currentDate.getFullYear());
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-sm ${theme.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-safe shadow-2xl border ${theme.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-bold text-lg ${theme.text}`}>選擇年月</h3>
          <button onClick={onClose} className={`p-2 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5" /></button>
        </div>
        <div className={`flex justify-between items-center ${theme.bg} p-3 rounded-2xl mb-4`}>
          <button onClick={() => setYear(year - 1)} className={`p-2 ${theme.textMuted} hover:opacity-80 rounded-xl transition-colors`}><ChevronLeft className="w-5 h-5"/></button>
          <span className={`text-xl font-black ${theme.text}`}>{year} 年</span>
          <button onClick={() => setYear(year + 1)} className={`p-2 ${theme.textMuted} hover:opacity-80 rounded-xl transition-colors`}><ChevronRight className="w-5 h-5"/></button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {months.map(m => {
            const isCurrent = year === currentDate.getFullYear() && m === currentDate.getMonth() + 1;
            return (
              <button key={m} onClick={() => onSelect(new Date(year, m - 1, 1))} className={`py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 border-2 ${isCurrent ? `${theme.primary} text-white border-transparent shadow-md` : `${theme.bg} ${theme.border} ${theme.text} hover:opacity-80`}`}>
                {m}月
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TransactionModal({ onClose, onSave, accounts, workspace, globalTags, onAddGlobalTag, theme, onShowToast }) {
  const [type, setType] = useState('expense');
  const currentCategories = workspace === 'family' ? (type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES) : (type === 'expense' ? STUDIO_EXPENSE_CATEGORIES : INCOME_CATEGORIES);
  const defaultAccount = workspace === 'family' ? 'acc_joint' : 'acc_studio';
  const [category, setCategory] = useState(currentCategories[0].name); 
  const [accountId, setAccountId] = useState(defaultAccount);
  const [note, setNote] = useState('');
  const [payer, setPayer] = useState('joint'); 
  const [split, setSplit] = useState('half'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calcStr, setCalcStr] = useState(''); 
  const [isCalculated, setIsCalculated] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [showKeypad, setShowKeypad] = useState(true);
  
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [aiText, setAiText] = useState('');
  const [isAiMode, setIsAiMode] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);

  const getRoleStyle = (role) => role === 'husband' ? 'bg-[#EAE0D5] text-[#6B4E31]' : role === 'wife' ? 'bg-[#FEF0C7] text-[#B57C00]' : 'bg-stone-200 text-stone-600';
  const getRoleName = (role) => role === 'husband' ? '👨 老公' : role === 'wife' ? '👩 老婆' : role === 'half' ? '平分' : '🤝 共同';

  const handlePayerChange = (newPayer) => { setPayer(newPayer); if (newPayer === 'joint') setSplit('joint'); if (newPayer !== 'joint' && split === 'joint') setSplit('half'); };

  const handleKeypadClick = (key) => {
    if (key === 'C') { setCalcStr(''); setIsCalculated(false); } 
    else if (key === '⌫') { if (isCalculated) { setCalcStr(''); setIsCalculated(false); } else setCalcStr(prev => prev.slice(0, -1)); } 
    else if (key === '=') { try { const result = new Function(`return ${calcStr.replace(/×/g, '*').replace(/÷/g, '/')}`)(); if (!isNaN(result)) { setCalcStr(String(Math.round(result * 100) / 100)); setIsCalculated(true); } } catch (e) {} } 
    else { if (isCalculated && !['+', '-', '×', '÷'].includes(key)) { setCalcStr(key); setIsCalculated(false); } else { setCalcStr(prev => prev + key); setIsCalculated(false); } }
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) setSelectedTags(selectedTags.filter(t => t !== tag));
    else setSelectedTags([...selectedTags, tag]);
  };
  
  const handleAddNewTag = () => {
    const t = newTagInput.trim();
    if (t) { onAddGlobalTag(t); if (!selectedTags.includes(t)) setSelectedTags([...selectedTags, t]); setNewTagInput(''); }
  };

  const handleAIParse = async () => {
    if (!aiText.trim()) return;
    setIsAiParsing(true);
    try {
       const apiKey = ""; 
       const prompt = `請將以下自然語言記帳轉換為 JSON 格式。
       語言：「${aiText}」
       必填 JSON 欄位：
       - amount (數字，擷取金額)
       - category (字串，從以下選擇最適合的：${currentCategories.map(c=>c.name).join(',')})
       - payer (字串，'husband' 代表老公付/我先刷卡的, 'wife' 代表老婆付, 'joint' 代表共同/現金付)
       - note (字串，擷取花費項目或重點備註)
       若無法判斷 payer 預設為 'joint'。`;
       
       const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
       });
       const data = await res.json();
       const result = JSON.parse(data.candidates[0].content.parts[0].text);
       
       if (result.amount) setCalcStr(String(result.amount));
       if (result.category) setCategory(result.category);
       if (result.payer) { setPayer(result.payer); if(result.payer!=='joint') setSplit('half'); else setSplit('joint'); }
       if (result.note) setNote(result.note);
       setIsAiMode(false); setAiText('');
       onShowToast("AI 解析成功！");
    } catch (e) { onShowToast("AI 解析失敗，請檢查輸入", "error"); } finally { setIsAiParsing(false); }
  };

  const handleSubmit = async (e) => {
    if(e) e.preventDefault(); 
    let finalAmount = 0;
    try { finalAmount = new Function(`return ${calcStr.replace(/×/g, '*').replace(/÷/g, '/')}`)(); } catch(e) { finalAmount = Number(calcStr); }
    if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0 || isSubmitting) return;
    setIsSubmitting(true); 
    await onSave({ type, amount: finalAmount, category, accountId, note, payer, split: type === 'income' ? payer : split, who: payer, hasPhoto, tags: selectedTags }); 
    setIsSubmitting(false); 
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md ${theme.cardInner} rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col h-[94vh] border ${theme.border}`}>
        
        <div className={`px-6 pt-6 pb-3 shrink-0 border-b ${theme.border}`}>
          <div className="flex justify-between items-center mb-3">
            <div className={`flex ${theme.bg} p-1 rounded-xl border ${theme.border}`}>
              <button type="button" className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all ${type === 'expense' ? `${theme.cardInner} shadow-sm ${theme.text}` : theme.textMuted}`} onClick={() => { setType('expense'); setCategory(workspace === 'family' ? EXPENSE_CATEGORIES[0].name : STUDIO_EXPENSE_CATEGORIES[0].name); }}>支出</button>
              <button type="button" className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all ${type === 'income' ? `${theme.cardInner} shadow-sm ${theme.text}` : theme.textMuted}`} onClick={() => { setType('income'); setCategory(INCOME_CATEGORIES[0].name); }}>收入</button>
            </div>
            <button onClick={onClose} className={`p-2 ${theme.bg} ${theme.textMuted} hover:opacity-80 rounded-full`}><X className="w-5 h-5" /></button>
          </div>
          
          <button onClick={() => setIsAiMode(!isAiMode)} className={`w-full py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all ${isAiMode ? 'bg-indigo-500 text-white shadow-md' : `${theme.bg} ${theme.textMuted} border ${theme.border}`}`}>
            <Wand2 className="w-4 h-4" /> AI 語音 / 文字智能記帳
          </button>
          
          {isAiMode && (
            <div className="mt-3 animate-in slide-in-from-top-2">
              <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="例如：訂了兩間房花了 6000 我先刷卡的..." className={`w-full ${theme.input} rounded-xl p-3 text-sm focus:outline-none focus:ring-2 ring-indigo-500 resize-none h-20 mb-2 font-bold`} />
              <button onClick={handleAIParse} disabled={isAiParsing || !aiText} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 disabled:opacity-50 active:scale-95">
                {isAiParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 解析並填寫
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 hide-scrollbar">
          <div onClick={() => setShowKeypad(true)} className={`flex flex-col items-center py-4 ${theme.bg} rounded-[2rem] border ${theme.border} cursor-pointer hover:opacity-90`}>
             <div className={`flex items-center justify-center gap-1 ${theme.textMuted} mb-1`}><Calculator className="w-4 h-4" /> <span className="text-xs font-bold">{showKeypad ? '輸入中...' : '點擊展開算盤'}</span></div>
             <div className="flex items-baseline justify-center w-full px-4 overflow-hidden"><span className={`text-3xl mr-2 font-light ${theme.textMuted}`}>$</span><div className={`text-6xl font-black truncate max-w-[250px] ${!calcStr ? 'opacity-30' : ''} ${workspace === 'studio' ? 'text-indigo-500' : theme.text}`}>{calcStr || '0'}</div></div>
          </div>

          <div>
            <label className={`block text-xs font-bold ${theme.textMuted} mb-2`}>分類</label>
            <div className="grid grid-cols-4 gap-2">
              {currentCategories.map(cat => (
                <button key={cat.id} type="button" onClick={() => setCategory(cat.name)} className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${category === cat.name ? (workspace === 'studio' ? 'border-indigo-600 bg-indigo-500/10' : `border-[#5C4033] bg-[#5C4033]/10`) : `border-transparent ${theme.textMuted} ${theme.bg}`}`}>
                  <span className="text-xl mb-1">{cat.icon}</span><span className="text-[10px] font-bold">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold ${theme.textMuted} mb-2`}>帳戶</label>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {accounts.map(acc => {
                const isSelected = accountId === acc.id;
                const brandStyle = isSelected ? 'border-indigo-600 bg-indigo-500/10 text-indigo-500' : `border-transparent ${theme.bg} ${theme.textMuted}`;
                const familyStyle = isSelected ? 'border-[#5C4033] bg-[#5C4033]/10 text-[#5C4033]' : `border-transparent ${theme.bg} ${theme.textMuted}`;
                return (
                  <button key={acc.id} type="button" onClick={() => setAccountId(acc.id)} className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl border-2 transition-all ${acc.type === 'brand' ? brandStyle : familyStyle}`}>
                    <span className="text-sm">{acc.icon}</span><span className="text-xs font-bold">{acc.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold ${theme.textMuted} mb-2 flex items-center gap-1`}><Tag className="w-3 h-3"/> 標籤 (選填)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {globalTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${isSelected ? `${theme.primary} text-white border-transparent` : `${theme.bg} ${theme.textMuted} border-transparent hover:border-stone-300`}`}>
                    #{tag}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} placeholder="新增新標籤..." className={`flex-1 ${theme.input} text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 ring-black/10 font-bold`} />
              <button type="button" onClick={handleAddNewTag} disabled={!newTagInput.trim()} className={`px-4 rounded-xl ${theme.bg} ${theme.text} font-bold disabled:opacity-50 active:scale-95`}>+</button>
            </div>
          </div>

          <div className={`${theme.bg} rounded-2xl p-4 space-y-4 border ${theme.border}`}>
            <div className="flex items-center justify-between"><span className={`text-xs font-bold ${theme.textMuted} w-20`}>付款人</span><div className="flex gap-1.5">{['husband', 'wife', 'joint'].map((role) => (<button key={role} type="button" onClick={() => handlePayerChange(role)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${payer === role ? `${getRoleStyle(role)} shadow-sm` : `${theme.cardInner} ${theme.textMuted}`}`}>{getRoleName(role)}</button>))}</div></div>
            {type === 'expense' && (<div className={`flex items-center justify-between pt-2 border-t ${theme.border}`}><span className={`text-xs font-bold ${theme.textMuted} w-20`}>負責人</span><div className="flex gap-1.5">{payer === 'joint' ? (<span className={`text-xs ${theme.textMuted} italic font-bold`}>共同負責</span>) : (['husband', 'wife', 'half'].map((role) => (<button key={role} type="button" onClick={() => setSplit(role)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${split === role ? 'bg-stone-700 text-white shadow-sm' : `${theme.cardInner} ${theme.textMuted}`}`}>{getRoleName(role)}</button>)))}</div></div>)}
            <div className="relative mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <ReceiptText className={`w-4 h-4 ${theme.textMuted} absolute left-3 top-1/2 -translate-y-1/2`} />
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註 (選填)" className={`w-full ${theme.input} text-sm py-3 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-2 ring-black/10 font-bold`} />
              </div>
              <button type="button" onClick={() => setHasPhoto(!hasPhoto)} className={`p-3 rounded-xl transition-all ${hasPhoto ? `${theme.primary} text-white shadow-md` : `${theme.cardInner} ${theme.textMuted}`}`}><Camera className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        <div className={`shrink-0 ${theme.bg} border-t ${theme.border} p-4 pb-safe transition-all duration-300`}>
          <div className="flex justify-between items-center mb-3">
             <span className={`text-xs font-bold ${theme.textMuted}`}>金額輸入</span>
             <button type="button" onClick={() => setShowKeypad(!showKeypad)} className={`p-1.5 rounded-full ${theme.cardInner} ${theme.textMuted} border ${theme.border}`}>
                {showKeypad ? <ChevronDown className="w-4 h-4"/> : <Keyboard className="w-4 h-4"/>}
             </button>
          </div>
          
          {showKeypad && (
            <div className="grid grid-cols-4 gap-2 mb-2 animate-in slide-in-from-bottom-2">
              {['7','8','9','÷', '4','5','6','×', '1','2','3','-', 'C','0','+','='].map((key) => {
                const isOperator = ['+', '-', '×', '÷', '='].includes(key); const isAction = ['C', '⌫'].includes(key); 
                const btnClass = isOperator ? `bg-black/10 ${theme.primaryText} shadow-sm` : isAction ? `bg-black/20 ${theme.textMuted} shadow-sm` : `${theme.cardInner} ${theme.text} shadow-sm`;
                return (<button key={key} type="button" onClick={() => handleKeypadClick(key)} className={`h-12 rounded-xl text-xl font-black flex items-center justify-center transition-transform active:scale-90 border ${theme.border} ${btnClass}`}>{key}</button>) 
              })}
            </div>
          )}
          
          <button type="button" onClick={handleSubmit} disabled={!calcStr || isSubmitting} className={`w-full text-white py-4 rounded-2xl font-bold active:scale-95 text-lg mt-2 disabled:opacity-50 transition-colors ${workspace === 'studio' ? 'bg-indigo-600' : theme.primary} flex items-center justify-center gap-2`}>
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : '確認記帳'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddAccountModal({ onClose, onSave, theme }) {
  const [name, setName] = useState(''); const [type, setType] = useState('joint'); const [icon, setIcon] = useState('🏦');
  const icons = ['🏦', '💳', '💵', '💼', '🐖', '🪙', '💎'];
  const handleSubmit = (e) => { e.preventDefault(); if (name) onSave({ name, type, icon, balance: 0 }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className={`w-full max-w-sm ${theme.cardInner} rounded-3xl p-6 shadow-2xl border ${theme.border}`}><div className="flex justify-between items-center mb-5"><h3 className={`font-bold text-lg ${theme.text}`}>🏦 新增帳戶</h3><button onClick={onClose} className={`p-1 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5"/></button></div><form onSubmit={handleSubmit} className="space-y-4"><div><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>帳戶名稱</label><input type="text" value={name} onChange={e=>setName(e.target.value)} autoFocus placeholder="例如: 國泰世華" className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 text-sm font-bold focus:outline-none`} /></div><div><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>屬性歸類</label><div className="flex gap-2"><button type="button" onClick={()=>setType('joint')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${type==='joint'?`bg-black/5 ${theme.primaryText} border-transparent`:`${theme.bg} ${theme.border} ${theme.textMuted}`}`}>家庭</button><button type="button" onClick={()=>setType('brand')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${type==='brand'?'bg-indigo-500/10 text-indigo-500 border-transparent':`${theme.bg} ${theme.border} ${theme.textMuted}`}`}>工作室</button></div></div><div><label className={`block text-xs font-bold ${theme.textMuted} mb-2`}>選擇圖示</label><div className="flex gap-2 flex-wrap">{icons.map(i => (<button key={i} type="button" onClick={()=>setIcon(i)} className={`w-10 h-10 rounded-full text-lg flex items-center justify-center transition-all ${icon===i?`${theme.primary} border-transparent grayscale-0`:`${theme.bg} border ${theme.border} grayscale`}`}>{i}</button>))}</div></div><button type="submit" disabled={!name} className={`w-full mt-4 ${theme.primary} text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-95`}>建立帳戶</button></form></div></div>
  );
}

function AddBillModal({ onClose, onSave, theme }) {
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [dueDate, setDueDate] = useState(1); const [isStudio, setIsStudio] = useState(false);
  const handleSubmit = (e) => { e.preventDefault(); if (name && amount) onSave({ name, amount: Number(amount), dueDate: Number(dueDate), category: isStudio ? '軟體訂閱' : '居家', icon: isStudio ? '💻' : '🏠', isStudio }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className={`w-full max-w-sm ${theme.cardInner} rounded-3xl p-6 shadow-2xl border ${theme.border}`}><div className="flex justify-between items-center mb-5"><h3 className={`font-bold text-lg ${theme.text}`}>📅 新增固定帳單</h3><button onClick={onClose} className={`p-1 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5"/></button></div><form onSubmit={handleSubmit} className="space-y-4"><div><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>帳單名稱</label><input type="text" value={name} onChange={e=>setName(e.target.value)} autoFocus placeholder="例如: 手機費" className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 text-sm font-bold focus:outline-none`} /></div><div className="flex gap-3"><div className="flex-1"><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>金額</label><input type="number" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 text-sm font-bold focus:outline-none`} /></div><div className="flex-1"><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>每月幾號繳？</label><input type="number" min="1" max="31" value={dueDate} onChange={e=>setDueDate(e.target.value)} className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 text-sm font-bold focus:outline-none`} /></div></div><div className="flex items-center gap-2 mt-2 cursor-pointer" onClick={()=>setIsStudio(!isStudio)}><div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${isStudio ? 'bg-indigo-500 border-indigo-500':`${theme.border}`}`}>{isStudio && <Check className="w-3 h-3 text-white"/>}</div><span className={`text-sm font-bold ${theme.text}`}>這是工作室的帳單</span></div><button type="submit" disabled={!name || !amount} className={`w-full mt-4 ${theme.primary} text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-95`}>建立帳單</button></form></div></div>
  );
}

function AddEventModal({ onClose, onSave, theme }) {
  const [title, setTitle] = useState(''); const [dateStr, setDateStr] = useState(getLocalYYYYMMDD(new Date())); const [icon, setIcon] = useState('🎉');
  const icons = ['🎉', '🎂', '✈️', '❤️', '🥂', '🏠', '👶', '🚗'];
  return ( <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className={`w-full max-w-sm ${theme.cardInner} rounded-[2rem] p-6 shadow-2xl border ${theme.border}`}><div className="flex justify-between items-center mb-5"><h3 className="font-bold text-lg text-rose-500 flex items-center gap-2"><CalendarHeart className="w-5 h-5"/> 重要的日子</h3><button onClick={onClose} className={`p-1 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5" /></button></div><form onSubmit={(e)=>{e.preventDefault(); if(title && dateStr) onSave({title, date: dateStr, icon});}} className="space-y-4"><div><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>是什麼日子？</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="例如：交往三週年" className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 text-sm font-bold focus:outline-none`} /></div><div><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>日期</label><input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 text-sm font-bold focus:outline-none`} /></div><div><label className={`block text-xs font-bold ${theme.textMuted} mb-2`}>選擇圖示</label><div className="flex gap-2 flex-wrap justify-center">{icons.map(i => (<button key={i} type="button" onClick={() => setIcon(i)} className={`w-10 h-10 rounded-full text-lg flex items-center justify-center transition-transform ${icon === i ? 'bg-rose-500/20 border-2 border-rose-400 scale-110' : `${theme.bg} border ${theme.border} grayscale-[50%]`}`}>{i}</button>))}</div></div><button type="submit" disabled={!title || !dateStr} className="w-full mt-4 bg-rose-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-md shadow-rose-500/20 active:scale-95">儲存日子</button></form></div></div> );
}

function NoteEditorModal({ onClose, onSave, onDelete, initialData, theme }) {
  const [title, setTitle] = useState(initialData?.title || ''); const [content, setContent] = useState(initialData?.content || '');
  return ( <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-full max-w-md bg-[#FEF0C7] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col h-[85vh] p-6 pb-safe border border-[#E9C46A]"><div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-[#B57C00] flex items-center gap-2"><StickyNote className="w-5 h-5"/> 共同記事</h3><div className="flex items-center gap-2">{initialData && (<button onClick={() => onDelete(initialData.id)} className="p-2 text-[#B57C00]/60 hover:text-red-500 hover:bg-white/50 rounded-full transition-colors"><Trash2 className="w-5 h-5" /></button>)}<button onClick={onClose} className="p-2 bg-white/50 text-[#B57C00] hover:bg-white rounded-full transition-colors"><X className="w-5 h-5" /></button></div></div><div className="flex-1 flex flex-col gap-4"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="記事標題..." autoFocus className="w-full bg-transparent border-b-2 border-[#E9C46A] px-2 py-3 text-2xl font-bold text-stone-800 focus:outline-none placeholder:text-[#B57C00]/40" /><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="在這裡寫下需要共同記住的事情..." className="w-full flex-1 bg-white/40 backdrop-blur-sm border border-white/50 rounded-2xl p-4 text-stone-700 leading-relaxed resize-none focus:outline-none focus:bg-white/60 transition-colors placeholder:text-[#B57C00]/40 font-bold"></textarea></div><button onClick={() => onSave({ id: initialData?.id, title, content })} disabled={!title && !content} className="w-full mt-6 bg-stone-800 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-50">儲存記事</button></div></div> );
}

function SettingsModal({ onClose, settings, onSave, onExport, theme }) {
  const [budget, setBudget] = useState(settings.monthlyBudget || '');
  const [enableRollover, setEnableRollover] = useState(settings.enableRollover !== false); 
  const [autoSyncInvoices, setAutoSyncInvoices] = useState(settings.autoSyncInvoices !== false); 
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-sm ${theme.cardInner} rounded-[2rem] p-6 shadow-2xl border ${theme.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-bold text-xl ${theme.text}`}>⚙️ 設定與管理</h3>
          <button onClick={onClose} className={`p-2 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className={`${theme.bg} p-4 rounded-2xl border ${theme.border}`}>
            <label className={`block text-sm font-bold ${theme.text} mb-2`}>每月家庭總預算</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted} font-bold`}>$</span>
                <input type="number" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} className={`w-full ${theme.cardInner} border ${theme.border} ${theme.text} rounded-xl pl-7 pr-3 py-3 text-sm font-bold focus:outline-none`} />
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-4 cursor-pointer" onClick={() => setEnableRollover(!enableRollover)}>
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${enableRollover ? `${theme.primary} border-transparent` : theme.border}`}>
                {enableRollover && <Check className="w-3 h-3 text-white"/>}
              </div>
              <span className={`text-xs font-bold ${theme.textMuted}`}>啟用預算結轉 (上月剩餘加到本月)</span>
            </div>

            <div className="flex items-center gap-2 mt-3 cursor-pointer" onClick={() => setAutoSyncInvoices(!autoSyncInvoices)}>
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${autoSyncInvoices ? `${theme.primary} border-transparent` : theme.border}`}>
                {autoSyncInvoices && <Check className="w-3 h-3 text-white"/>}
              </div>
              <span className={`text-xs font-bold ${theme.textMuted}`}>開啟 App 時自動同步雲端發票</span>
            </div>
          </div>
          
          <button onClick={() => onSave({ monthlyBudget: Number(budget), enableRollover, autoSyncInvoices })} className={`w-full ${theme.primary} text-white py-3.5 rounded-xl font-bold active:scale-95 shadow-md`}>
            儲存所有設定
          </button>

          <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex flex-col items-start mt-6">
             <div className="flex items-center gap-2 mb-1"><DownloadCloud className="w-5 h-5 text-emerald-600" /><span className="font-bold text-emerald-600">資料匯出</span></div>
             <p className="text-xs text-emerald-600/80 mb-4 font-bold">將所有帳目下載為 CSV 檔案，可直接丟進 Google Sheets 或是 Excel 進行進階分析。</p>
             <button onClick={onExport} className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors active:scale-95 shadow-md">
               匯出至 Excel / Sheets
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarcodeModal({ onClose, barcodes, onSaveSettings, onAddTx, onShowToast, theme, activeWorkspace }) {
  const [activeTab, setActiveTab] = useState('husband'); 
  const [isEditing, setIsEditing] = useState(false); 
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [hCode, setHCode] = useState(barcodes.husbandBarcode || ''); 
  const [wCode, setWCode] = useState(barcodes.wifeBarcode || ''); 
  const [hCert, setHCert] = useState(barcodes.husbandCert || ''); 
  const [wCert, setWCert] = useState(barcodes.wifeCert || ''); 

  const displayCode = activeTab === 'husband' ? hCode || '/HUSBAND' : wCode || '/WIFEXXX';

  const handleSyncInvoices = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    const mockInvoices = [
      { type: 'expense', amount: 155, category: '餐飲', accountId: activeWorkspace === 'family' ? 'acc_joint' : 'acc_studio', note: '7-ELEVEN (自動匯入)', payer: activeTab, split: 'half', who: activeTab, tags: ['雲端發票'] },
      { type: 'expense', amount: 890, category: '居家', accountId: activeWorkspace === 'family' ? 'acc_joint' : 'acc_studio', note: '全聯福利中心 (自動匯入)', payer: activeTab, split: 'half', who: activeTab, tags: ['雲端發票'] }
    ];
    for(let inv of mockInvoices) { await onAddTx(inv); }
    setIsSyncing(false);
    onShowToast(`成功同步 2 筆雲端發票！`);
    onClose();
  };

  return ( 
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-sm ${theme.cardInner} rounded-[2rem] p-6 shadow-2xl border ${theme.border}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-bold text-xl ${theme.text} flex items-center gap-2`}><Barcode className={`w-5 h-5 ${theme.textMuted}`}/> 發票載具與同步</h3>
          <button onClick={onClose} className={`p-2 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5" /></button>
        </div>
        
        <div className={`flex ${theme.bg} p-1 rounded-xl border ${theme.border} mb-6`}>
          <button onClick={() => setActiveTab('husband')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'husband' ? `${theme.cardInner} shadow-sm text-[#6B4E31]` : theme.textMuted}`}>👨 老公</button>
          <button onClick={() => setActiveTab('wife')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'wife' ? `${theme.cardInner} shadow-sm text-[#B57C00]` : theme.textMuted}`}>👩 老婆</button>
        </div>
        
        {isEditing ? (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 hide-scrollbar">
            <div className={`p-4 rounded-xl border ${theme.border} ${theme.bg}`}>
              <h4 className={`text-sm font-bold mb-3 ${theme.text}`}>👨 老公載具設定</h4>
              <label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>手機條碼</label>
              <input type="text" value={hCode} onChange={e=>setHCode(e.target.value)} className={`w-full ${theme.cardInner} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 font-mono text-sm uppercase font-bold focus:outline-none mb-3`} />
              <label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>驗證碼 (密碼)</label>
              <input type="password" value={hCert} onChange={e=>setHCert(e.target.value)} placeholder="用於同步發票明細" className={`w-full ${theme.cardInner} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none`} />
            </div>
            
            <div className={`p-4 rounded-xl border ${theme.border} ${theme.bg}`}>
              <h4 className={`text-sm font-bold mb-3 ${theme.text}`}>👩 老婆載具設定</h4>
              <label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>手機條碼</label>
              <input type="text" value={wCode} onChange={e=>setWCode(e.target.value)} className={`w-full ${theme.cardInner} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 font-mono text-sm uppercase font-bold focus:outline-none mb-3`} />
              <label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>驗證碼 (密碼)</label>
              <input type="password" value={wCert} onChange={e=>setWCert(e.target.value)} placeholder="用於同步發票明細" className={`w-full ${theme.cardInner} border ${theme.border} ${theme.text} rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none`} />
            </div>
            
            <button onClick={() => { onSaveSettings(hCode, wCode, hCert, wCert); setIsEditing(false); }} className={`w-full mt-2 ${theme.primary} text-white font-bold py-3.5 rounded-xl active:scale-95`}>儲存設定</button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="bg-white border-2 border-stone-200 rounded-2xl p-4 w-full flex flex-col items-center justify-center py-8 shadow-sm relative overflow-hidden">
               <div className="flex h-20 w-full justify-center overflow-hidden mb-4 opacity-80">
                 {Array.from({ length: 40 }).map((_, i) => (<div key={i} className="h-full bg-black" style={{ width: `${Math.random() * 4 + 1}px`, marginRight: `${Math.random() * 3 + 1}px` }}></div>))}
               </div>
               <span className="font-mono text-2xl tracking-[0.2em] font-bold text-stone-800">{displayCode}</span>
            </div>
            
            <button onClick={handleSyncInvoices} disabled={isSyncing} className={`w-full mt-6 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all active:scale-95 ${isSyncing ? 'bg-stone-200 text-stone-400' : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600'}`}>
               {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />} 
               {isSyncing ? '正在抓取明細...' : '🔄 手動同步最新發票'}
            </button>

            <button onClick={() => setIsEditing(true)} className={`text-sm font-bold ${theme.primaryText} mt-4 px-4 py-2 bg-black/5 rounded-full`}>修改條碼與密碼</button>
          </div>
        )}
      </div>
    </div> 
  );
}

function AddGoalModal({ onClose, onSave, theme }) {
  const [title, setTitle] = useState(''); const [targetAmount, setTargetAmount] = useState('');
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className={`w-full max-w-sm ${theme.cardInner} rounded-3xl p-6 shadow-2xl border ${theme.border}`}><div className="flex justify-between items-center mb-5"><h3 className={`font-bold text-lg ${theme.text}`}>🎯 新增目標</h3><button onClick={onClose} className={`p-1 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5" /></button></div><form onSubmit={(e)=>{e.preventDefault(); onSave({title, targetAmount:Number(targetAmount)});}} className="space-y-4"><div><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>名稱</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl px-3 py-3 text-sm font-bold focus:outline-none`} /></div><div><label className={`block text-xs font-bold ${theme.textMuted} mb-1`}>金額</label><div className="relative"><span className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted} font-bold`}>$</span><input type="number" inputMode="decimal" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className={`w-full ${theme.bg} border ${theme.border} ${theme.text} rounded-xl pl-7 pr-3 py-3 text-sm font-bold focus:outline-none`} /></div></div><button type="submit" disabled={!title || !targetAmount} className={`w-full mt-2 ${theme.primary} text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-95`}>建立</button></form></div></div>);
}

function AddFundsModal({ onClose, onSave, goalName, theme }) {
  const [amount, setAmount] = useState('');
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className={`w-full max-w-sm ${theme.cardInner} rounded-3xl p-6 shadow-2xl border ${theme.border}`}><div className="flex justify-between items-center mb-2"><h3 className={`font-bold text-lg ${theme.text}`}>💰 存入資金</h3><button onClick={onClose} className={`p-1 ${theme.bg} ${theme.textMuted} rounded-full`}><X className="w-5 h-5" /></button></div><p className={`text-xs ${theme.textMuted} mb-5 font-bold`}>存入 <span className={theme.text}>{goalName}</span></p><form onSubmit={(e)=>{e.preventDefault(); onSave(Number(amount));}} className="space-y-4"><div className={`flex items-baseline justify-center border-b-2 ${theme.border} py-4`}><span className={`text-3xl ${theme.textMuted} mr-2 font-light`}>$</span><input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoFocus placeholder="0" className={`text-5xl font-black bg-transparent ${theme.text} focus:outline-none w-2/3 text-center`} /></div><button type="submit" disabled={!amount} className={`w-full mt-4 ${theme.primary} text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-95`}>確認存入</button></form></div></div>);
}