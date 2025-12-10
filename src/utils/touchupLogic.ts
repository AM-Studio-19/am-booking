import { Service } from '../types';

// 計算兩個日期相差的月份數
export const getMonthsDiff = (fromDate: string, toDate: Date = new Date()) => {
  const start = new Date(fromDate);
  const end = toDate;
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const result = years * 12 + months;
  // 如果日期還沒到 (例如 10/15 vs 12/10 -> 算 1 個月又多一點，通常無條件捨去或四捨五入，這邊採用最寬鬆的月份差)
  return Math.max(0, result);
};

// 根據月份找到對應的補色服務
export const findTouchupService = (
  category: string, // '霧眉' 或 '霧唇'
  lastVisitDate: string,
  services: Service[]
): { service: Service | null, months: number, label: string } => {
  const months = getMonthsDiff(lastVisitDate);
  
  // 這裡定義你的時間區段邏輯，需對應你在後台設定的「時段」文字
  let targetLabel = '';
  if (months <= 3) targetLabel = '3個月內';
  else if (months <= 6) targetLabel = '半年內'; 
  else if (months <= 12) targetLabel = '一年內';
  else if (months <= 18) targetLabel = '一年半內';
  else if (months <= 24) targetLabel = '兩年內';
  else targetLabel = '重新施作';

  // 在服務列表中尋找符合「類別 + 補色 + 時段」的項目
  const service = services.find(s => 
    s.category === category && 
    s.type === '補色' && 
    (s.timeRange === targetLabel || s.timeRange?.includes(targetLabel))
  );

  return { service: service || null, months, label: targetLabel };
};
