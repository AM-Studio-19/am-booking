import React, { useState } from 'react';
import { Icon, Button, Spinner } from './Shared';
import { firebaseService } from '../services/firebase';
import { Service } from '../types';
import { findTouchupService } from '../utils/touchupLogic';

interface Props {
  services: Service[];
}

export const TouchupChecker: React.FC<Props> = ({ services }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    customer: string;
    records: Array<{ category: string; lastDate: string; price: number | null; rangeLabel: string; months: number }>;
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return alert('請輸入姓名或電話');
    setLoading(true);
    setResult(null);

    try {
      const bookings = await firebaseService.searchBookings(query.trim());
      // 過濾出有效訂單 (已確認 或 已付訂金) 且 日期在今天之前
      const validBookings = bookings.filter(b => 
        (b.status === 'confirmed' || b.paymentStatus === 'verified') && 
        new Date(b.date) < new Date()
      );

      if (validBookings.length === 0) {
        alert('查無歷史施作紀錄 (或預約尚未完成)');
        setLoading(false);
        return;
      }

      // 依類別分組 (只抓最近一次)
      const categories = ['霧眉', '霧唇'] as const;
      const records = [];

      for (const cat of categories) {
        // 找出該類別最近的一筆
        const catBookings = validBookings
          .filter(b => b.serviceName.includes(cat))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (catBookings.length > 0) {
          const lastVisit = catBookings[0];
          const { service, months, label } = findTouchupService(cat, lastVisit.date, services);
          
          records.push({
            category: cat,
            lastDate: lastVisit.date,
            price: service ? service.price : null,
            rangeLabel: label,
            months: months
          });
        }
      }

      if (records.length === 0) {
        alert('查無相關類別的施作紀錄');
      } else {
        setResult({
          customer: validBookings[0].customerName,
          records: records
        });
      }

    } catch (error) {
      console.error(error);
      alert('查詢失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#e7e0da] shadow-sm mt-4">
      <h3 className="font-bold text-[#8d6e63] mb-3 flex items-center gap-2 text-sm">
        <Icon name="search" size={16} /> 補色價格查詢 (舊客專用)
      </h3>
      
      <div className="flex gap-2 mb-2">
        <input 
          className="flex-1 p-2 bg-[#faf9f6] rounded-xl border border-[#e7e0da] text-sm outline-none focus:border-[#8d6e63] transition-colors"
          placeholder="輸入姓名或電話"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading} className="w-20 py-2 text-xs">
          {loading ? <Spinner /> : '查詢'}
        </Button>
      </div>

      {result && (
        <div className="space-y-3 pt-3 border-t border-dashed border-[#e7e0da] animate-fade-in">
          <div className="text-xs text-gray-400 text-center mb-1">
            顧客：<span className="text-[#5d4037] font-bold">{result.customer}</span>
          </div>
          
          {result.records.map((rec) => (
            <div key={rec.category} className="bg-[#fffbf9] p-3 rounded-xl border border-[#e7e0da] flex justify-between items-center relative overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#8d6e63]"></div>
               <div className="pl-2">
                  <div className="font-bold text-[#5d4037] text-sm">{rec.category}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">上次：{rec.lastDate} (約 {rec.months} 個月前)</div>
               </div>
               <div className="text-right">
                  {rec.price !== null ? (
                    <>
                      <div className="text-lg font-bold text-[#8d6e63]">${rec.price}</div>
                      <div className="text-[10px] text-gray-400 bg-white px-1 rounded border border-[#e7e0da] inline-block">
                        {rec.rangeLabel}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                       {rec.rangeLabel}
                    </div>
                  )}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
