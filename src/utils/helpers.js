// 1. 取得 YYYY-MM 格式 (用於月度統計)
export function getLocalYYYYMM(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return year + "-" + month;
}

// 2. 取得 YYYY-MM-DD 格式 (用於記帳日期)
export function getLocalYYYYMMDD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + "-" + month + "-" + day;
}

// 3. 取得 HH:mm 格式 (用於記帳時間)
export function getLocalHHmm(d) {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return hours + ":" + minutes;
}

// 4. 計算紀念日/帳單的「相差天數」
export function calculateDaysDiff(targetDateStr) {
  const target = new Date(targetDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

// 5. 帶有「自動重試」功能的 API 呼叫器 (用於 AI 服務與匯率抓取)
export async function fetchWithBackoff(url, options, retries = 3) {
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
}
