import React, { useState, useEffect, useMemo } from 'react';
import liff from '@line/liff';
import { Icon, Card, Button, Modal, Spinner } from './components/Shared';
import { TouchupChecker } from './components/TouchupChecker'; 
import { firebaseService } from './services/firebase';
import { 
  LOCATIONS, MAIN_CATS, SUB_CATS, TOUCHUP_SESSIONS, 
  DEFAULT_SLOTS, BANK_INFO, ADMIN_PIN, MOCK_SERVICES, LIFF_ID
} from './constants';
import { 
  Service, Guest, Location, BookingRecord, AppSettings, Discount, Template
} from './types';

// --- Helper Functions ---
const copyToClipboard = (text: string) => {
    if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert('已複製!');
        } catch (err) {
            alert('複製失敗');
        }
        document.body.removeChild(textArea);
        return;
    }
    navigator.clipboard.writeText(text).then(() => alert('已複製!'), () => alert('複製失敗'));
};

const calculateGuestDuration = (guestServices: Service[]) => {
    if (!guestServices || guestServices.length === 0) return 0;
    const totalMinutes = guestServices.reduce((acc, s) => acc + (s.duration || 120), 0);
    const reduction = guestServices.length > 1 ? 30 : 0;
    return Math.max(totalMinutes - reduction, 0);
};

// --- Admin Components ---

const AdminLogin = ({ onLogin, onBack }: { onLogin: () => void, onBack: () => void }) => {
  const [pin, setPin] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f6] p-6 fade-in">
      <div className="bg-white p-8 rounded-3xl shadow-lg w-full max-w-sm text-center border border-[#e7e0da]">
        <h2 className="text-xl font-bold mb-6 text-[#4e342e]">後台登入</h2>
        <input type="password" placeholder="PIN碼" className="w-full p-4 bg-[#fdfbf7] rounded-xl mb-6 text-center text-xl tracking-widest border border-[#d7ccc8] focus:border-[#8d6e63] outline-none" 
          value={pin} onChange={e => setPin(e.target.value)} />
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onBack}>取消</Button>
          <Button className="flex-1" onClick={() => {
              if (pin === ADMIN_PIN) onLogin();
              else alert('密碼錯誤');
          }}>登入</Button>
        </div>
      </div>
    </div>
  );
};

const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const [tab, setTab] = useState<'bookings' | 'services' | 'settings' | 'others'>('bookings');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [showTrash, setShowTrash] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  
  const [calDate, setCalDate] = useState(new Date());
  const [calSelected, setCalSelected] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState(''); 
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [manualBooking, setManualBooking] = useState({ date: new Date().toISOString().split('T')[0], time: '11:00', name: '', phone: '', locationId: LOCATIONS[0].id, serviceId: '' });
  const [settingsLoc, setSettingsLoc] = useState(LOCATIONS[0].id);
  const [actionBooking, setActionBooking] = useState<BookingRecord | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'confirm' | 'cancel' | 'no-deposit' | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const unsubs = [
      firebaseService.getAllBookings(setBookings),
      firebaseService.getServices(setServices),
      firebaseService.getTemplates(setTemplates),
      firebaseService.getDiscounts(setDiscounts),
      firebaseService.getSettings(setSettings)
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const generateMessage = (b: BookingRecord, type: string) => {
      const defaultTemplates: Record<string, string> = {
          confirm: `您好，您的預約已確認！\n時間：{{date}} {{time}}\n地點：{{location}}\n服務：{{service}}\n期待您的光臨。`,
          verify: `您好，已收到您的訂金匯款，預約正式保留。感謝您！`,
          cancel: `您好，您的預約已取消。若有需要請再次預約，謝謝。`,
          "no-deposit": `您好，您的預約已確認（無需訂金）。\n時間：{{date}} {{time}}\n地點：{{location}}\n服務：{{service}}\n期待您的光臨。`
      };
      
      const userTpl = templates.find(t => t.title.includes(type === 'confirm' ? '確認' : type === 'verify' ? '訂金' : type === 'no-deposit' ? '無需訂金' : '取消'))?.content;
      const tpl = userTpl || defaultTemplates[type] || defaultTemplates['confirm'];

      return tpl
        .replace('{{name}}', b.customerName)
        .replace('{{date}}', b.date)
        .replace('{{time}}', b.time)
        .replace('{{service}}', b.serviceName)
        .replace('{{location}}', b.locationName);
  };

  const openActionModal = (b: BookingRecord, type: 'verify' | 'confirm' | 'cancel' | 'no-deposit') => {
      setActionBooking(b);
      setActionType(type);
      setActionMessage(generateMessage(b, type));
  };

  const executeAction = async () => {
      if(!actionBooking || !actionType) return;
      try {
          const updates: any = {};
          if(actionType === 'verify') { updates.paymentStatus = 'verified'; }
          if(actionType === 'cancel') { updates.status = 'cancelled'; }
          if(actionType === 'confirm') { updates.status = 'confirmed'; updates.paymentStatus = 'verified'; }
          if(actionType === 'no-deposit') { updates.status = 'confirmed'; updates.paymentStatus = 'verified'; updates.deposit = 0; updates.notes = (actionBooking.notes || '') + ' [無需訂金]'; }
          
          await firebaseService.updateBookingStatus(actionBooking.id, updates);
          setActionBooking(null);
          setActionType(null);
      } catch (e) {
          console.error(e);
          alert('操作失敗');
      }
  };

  const handleManualAdd = async () => {
      if(!manualBooking.name || !manualBooking.phone || !manualBooking.serviceId) { alert('請填寫完整資訊'); return; }
      const selectedService = services.find(s => s.id === manualBooking.serviceId);
      const selectedLoc = LOCATIONS.find(l => l.id === manualBooking.locationId);
      if(!selectedService || !selectedLoc) return;
      const newBooking = {
          locationId: selectedLoc.id, locationName: selectedLoc.name, serviceId: [selectedService.id], serviceName: selectedService.name, serviceDuration: selectedService.duration || 120,
          date: manualBooking.date, time: manualBooking.time, customerName: manualBooking.name, customerPhone: manualBooking.phone, discountIdentity: '後台新增',
          groupId: 'ADMIN_' + Date.now(), guestIndex: 1, totalPrice: selectedService.price, deposit: 0, status: 'confirmed', paymentStatus: 'verified', userId: 'ADMIN', notes: '後台手動新增'
      };
      try { await firebaseService.createBookings([newBooking]); setIsManualAddOpen(false); setManualBooking({ ...manualBooking, name: '', phone: '' }); alert('新增成功'); } catch(e) { console.error(e); alert('新增失敗'); }
  };

  const handleBatchImport = async () => {
      if (!batchText.trim()) return;
      const lines = batchText.trim().split('\n');
      const newBookings: any[] = [];
      const errors: string[] = [];
      for (let i = 0; i < lines.length; i++) {
          const parts = lines[i].split(',').map(s => s.trim());
          if (parts.length < 5) { errors.push(`第 ${i+1} 行格式錯誤`); continue; }
          const [date, time, name, phone, serviceName] = parts;
          if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { errors.push(`第 ${i+1} 行日期格式錯誤`); continue; }
          const matchedService = services.find(s => serviceName.includes(s.name) || s.name.includes(serviceName));
          const price = matchedService ? matchedService.price : 0;
          const duration = matchedService ? (matchedService.duration || 120) : 120;
          const serviceId = matchedService ? [matchedService.id] : [];
          newBookings.push({
              locationId: LOCATIONS[0].id, locationName: LOCATIONS[0].name, serviceId, serviceName, serviceDuration: duration, date, time, customerName: name, customerPhone: phone,
              discountIdentity: '後台匯入', groupId: 'BATCH_' + Date.now(), guestIndex: 1, totalPrice: price, deposit: 0, status: 'confirmed', paymentStatus: 'verified', userId: 'ADMIN', notes: '批量匯入'
          });
      }
      if (errors.length > 0) { alert('部分匯入失敗：\n' + errors.join('\n')); if (newBookings.length === 0) return; }
      if (confirm(`即將匯入 ${newBookings.length} 筆資料，確認？`)) { try { await firebaseService.createBookings(newBookings); setBatchText(''); setIsBatchOpen(false); alert('匯入成功'); } catch (e) { console.error(e); alert('匯入失敗'); } }
  };

  const BookingCard: React.FC<{ b: BookingRecord }> = ({ b }) => (
    <Card className="relative overflow-hidden mb-3">
        <div className={`absolute left-0 top-0 bottom-0 w-2 ${b.status === 'confirmed' ? 'bg-green-500' : b.status === 'cancelled' ? 'bg-red-400' : 'bg-yellow-400'}`}></div>
        <div className="pl-3">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="font-bold text-lg text-[#5d4037]">{b.date} {b.time}</div>
                    <div className="text-gray-600">{b.customerName} <span className="text-xs text-gray-400">({b.customerPhone})</span></div>
                    <div className="text-xs text-[#8d6e63] mt-1 bg-[#faf9f6] inline-block px-2 py-0.5 rounded border border-[#e7e0da]">{b.locationName}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {b.status === 'confirmed' ? '已確認' : b.status === 'cancelled' ? '已取消' : '待確認'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${b.paymentStatus === 'verified' ? 'bg-green-100 text-green-700' : b.paymentStatus === 'reported' ? 'bg-blue-100 text-blue-700' : 'bg-red-50 text-red-500'}`}>
                        {b.paymentStatus === 'verified' ? '已付訂' : b.paymentStatus === 'reported' ? `已回報 (${b.paymentInfo?.last5})` : '未付訂'}
                    </span>
                </div>
            </div>
            <div className="text-sm text-gray-500 mb-2">{b.serviceName} | ${b.totalPrice}</div>
            <div className="text-xs text-gray-400 mb-2">預計時長: {Math.floor(b.serviceDuration/60)}h {b.serviceDuration%60}m</div>
            {b.notes && <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded mb-2">備註: {b.notes}</div>}
            
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {b.paymentStatus === 'unpaid' && b.status !== 'cancelled' && (
                    <button onClick={() => openActionModal(b, 'no-deposit')} className="text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded hover:bg-gray-200 font-bold flex items-center gap-1">
                        <Icon name="noDeposit" size={14}/> 無需訂金
                    </button>
                )}
                {/* Merged Confirm & Verify */}
                {b.status === 'pending' && b.status !== 'cancelled' && (
                    <button onClick={() => openActionModal(b, 'confirm')} className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded hover:bg-blue-200 font-bold">
                        確認預約
                    </button>
                )}
                {b.status !== 'cancelled' && (
                    <button onClick={() => openActionModal(b, 'cancel')} className="text-xs bg-red-100 text-red-700 px-3 py-2 rounded hover:bg-red-200 font-bold">
                        取消預約
                    </button>
                )}
            </div>
        </div>
    </Card>
  );

  const renderBookingsList = () => {
      const targetBookings = showTrash 
        ? bookings.filter(b => b.status === 'cancelled') 
        : bookings.filter(b => b.status !== 'cancelled');

      const pendingPayment = targetBookings.filter(b => b.paymentStatus === 'unpaid');
      const pendingVerify = targetBookings.filter(b => b.paymentStatus === 'reported');
      const pendingConfirm = targetBookings.filter(b => b.status === 'pending' && b.paymentStatus === 'verified');
      const upcoming = targetBookings.filter(b => b.status === 'confirmed' && new Date(b.date) >= new Date()).sort((a,b) => a.date.localeCompare(b.date));
      const history = targetBookings.filter(b => b.status === 'confirmed' && new Date(b.date) < new Date());
      
      const cancelledList = targetBookings; 

      const Section = ({ title, list }: { title: string, list: BookingRecord[] }) => (
          list.length > 0 ? (
              <div className="mb-6">
                  <h3 className="font-bold text-[#8d6e63] mb-3 px-1">{title} ({list.length})</h3>
                  {list.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
          ) : null
      );

      if (showTrash) {
          return (
              <div className="pb-20">
                  <div className="mb-4 p-2 bg-red-50 text-red-600 rounded text-center text-sm font-bold">🗑️ 已取消的預約</div>
                  <Section title="已取消清單" list={cancelledList} />
                  {cancelledList.length === 0 && <div className="text-center text-gray-400 mt-10">垃圾桶是空的</div>}
              </div>
          )
      }

      return (
          <div className="pb-20">
              <div className="mb-4 flex gap-2">
                  <Button variant="outline" onClick={() => setIsManualAddOpen(true)} className="flex-1 border-dashed text-sm py-2">
                      <Icon name="plus" size={16}/> 快速新增
                  </Button>
                  <Button variant="outline" onClick={() => setIsBatchOpen(true)} className="w-1/3 border-dashed text-sm py-2">
                      批量匯入
                  </Button>
              </div>
              <Section title="待確認款項 (已回報)" list={pendingVerify} />
              <Section title="待付訂金" list={pendingPayment} />
              <Section title="已付訂 / 待確認預約" list={pendingConfirm} />
              <Section title="即將到來" list={upcoming} />
              <Section title="歷史訂單" list={history} />
          </div>
      );
  };

  const renderBookingsCalendar = () => {
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const startDay = new Date(y, m, 1).getDay();
    const bookMap: Record<string, { hasPending: boolean, count: number }> = {};
    bookings.forEach(b => {
      if (b.status !== 'cancelled') {
        if (!bookMap[b.date]) bookMap[b.date] = { hasPending: false, count: 0 };
        if (b.status === 'pending') bookMap[b.date].hasPending = true;
        bookMap[b.date].count++;
      }
    });

    const selectedBookings = bookings.filter(b => b.date === calSelected && b.status !== 'cancelled').sort((a,b) => a.time.localeCompare(b.time));

    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-3xl border shadow-sm">
            <div className="flex justify-between items-center mb-4">
            <button onClick={() => setCalDate(new Date(y, m - 1))} className="px-3 py-1 bg-gray-100 rounded">&lt;</button>
            <span className="font-bold text-lg">{y}年 {m + 1}月</span>
            <button onClick={() => setCalDate(new Date(y, m + 1))} className="px-3 py-1 bg-gray-100 rounded">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-400">{['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const info = bookMap[dStr];
                const isSel = calSelected === dStr;
                return (
                <div key={d} onClick={() => setCalSelected(dStr)} 
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl font-medium cursor-pointer transition-all border 
                    ${isSel ? 'bg-[#8D6E63] text-white border-transparent' : 'bg-white border-gray-100 text-gray-700'}`}>
                    <span>{d}</span>
                    {info && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${info.hasPending ? 'bg-yellow-400' : 'bg-green-500'}`}></div>}
                </div>
                );
            })}
            </div>
        </div>
        {calSelected && selectedBookings.map(b => <BookingCard key={b.id} b={b} />)}
        {calSelected && selectedBookings.length === 0 && <div className="text-center text-gray-400 py-8">無預約資料</div>}
      </div>
    );
  };

  const renderServices = () => {
    const sorted = [...services].sort((a,b) => (a.order || 0) - (b.order || 0));
    return (
        <div className="space-y-3">
            <Button onClick={() => { setEditItem({ duration: 120 }); setEditType('service'); setIsEditOpen(true); }} className="w-full">新增服務</Button>
            {sorted.map(s => (
                <div key={s.id} className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-[#5d4037]">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.category} - {s.type} | ${s.price} | {s.duration || 120}分鐘</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { firebaseService.updateItem('services', s.id, { order: (s.order||0)-1 }); }} className="p-1 bg-gray-100 rounded">⬆</button>
                        <button onClick={() => { firebaseService.updateItem('services', s.id, { order: (s.order||0)+1 }); }} className="p-1 bg-gray-100 rounded">⬇</button>
                        <button onClick={() => { setEditItem(s); setEditType('service'); setIsEditOpen(true); }} className="p-1 bg-blue-100 text-blue-600 rounded">✎</button>
                        <button onClick={() => { if(confirm('刪除?')) firebaseService.deleteItem('services', s.id); }} className="p-1 bg-red-100 text-red-600 rounded">🗑</button>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const renderSettings = () => {
      const y = calDate.getFullYear();
      const m = calDate.getMonth();
      const days = new Date(y, m+1, 0).getDate();
      
      const locId = settingsLoc; 
      const currentGlobalSlots = settings[locId]?.timeSlots?.join(', ') || DEFAULT_SLOTS.join(', ');
      
      // Date specific slots
      const dateKey = calSelected || '';
      const specificSlots = settings[locId]?.specialRules?.[dateKey];

      return (
          <div className="space-y-6">
              {/* Location Switcher for Settings */}
              <div className="flex bg-white p-1 rounded-xl border shadow-sm">
                  {LOCATIONS.map(l => (
                      <button 
                          key={l.id}
                          onClick={() => setSettingsLoc(l.id)}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${settingsLoc === l.id ? 'bg-[#5d4037] text-white shadow-md' : 'text-gray-400'}`}>
                          {l.name}
                      </button>
                  ))}
              </div>

              <div className="bg-white p-4 rounded-2xl border">
                  <h3 className="font-bold mb-4">營業日設定 ({LOCATIONS.find(l=>l.id===locId)?.name})</h3>
                  <div className="flex justify-between mb-2">
                     <button onClick={()=>setCalDate(new Date(y, m-1))} className="px-2 bg-gray-100 rounded">&lt;</button>
                     <span>{y}/{m+1}</span>
                     <button onClick={()=>setCalDate(new Date(y, m+1))} className="px-2 bg-gray-100 rounded">&gt;</button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                      {Array.from({length: days}).map((_, i) => {
                          const d = i+1;
                          const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                          const allowed = settings[locId]?.allowedDates?.includes(dStr);
                          const isSel = calSelected === dStr;
                          return (
                              <button key={d} 
                                onClick={() => setCalSelected(dStr)}
                                className={`h-8 rounded relative border ${allowed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-300 border-transparent'} ${isSel ? 'ring-2 ring-[#8d6e63]' : ''}`}>
                                {d}
                              </button>
                          )
                      })}
                  </div>
                  
                  {calSelected && (
                      <div className="mt-4 pt-4 border-t">
                           <div className="flex justify-between items-center mb-2">
                               <div className="text-sm font-bold text-[#5d4037]">設定日期: {calSelected}</div>
                               <button 
                                 onClick={() => {
                                    const current = settings[locId]?.allowedDates || [];
                                    const next = current.includes(calSelected) ? current.filter(x=>x!==calSelected) : [...current, calSelected];
                                    firebaseService.updateSettings(locId, { allowedDates: next });
                                 }}
                                 className={`text-xs px-3 py-1 rounded font-bold ${settings[locId]?.allowedDates?.includes(calSelected) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                 {settings[locId]?.allowedDates?.includes(calSelected) ? '設為公休' : '設為營業'}
                               </button>
                           </div>
                           
                           {settings[locId]?.allowedDates?.includes(calSelected) && (
                               <div className="bg-gray-50 p-3 rounded-xl border mt-2">
                                   <label className="text-xs font-bold text-[#8d6e63] mb-1 block">當日特殊時段 (留空則使用預設)</label>
                                   <input 
                                     className="w-full p-2 border rounded text-sm"
                                     placeholder="e.g. 10:00, 14:00 (預設覆蓋)"
                                     value={specificSlots ? specificSlots.join(', ') : ''}
                                     onChange={(e) => {
                                         const val = e.target.value;
                                         const newMap = { ...(settings[locId]?.specialRules || {}) };
                                         if(!val.trim()) delete newMap[calSelected];
                                         else newMap[calSelected] = val.split(',').map(s=>s.trim()).filter(s=>s);
                                         firebaseService.updateSettings(locId, { specialRules: newMap });
                                     }}
                                   />
                                   <div className="text-[10px] text-gray-400 mt-1">預設時段: {currentGlobalSlots}</div>
                               </div>
                           )}
                      </div>
                  )}
              </div>

              <div className="bg-white p-4 rounded-2xl border">
                  <h3 className="font-bold mb-2">預設每日時段 ({LOCATIONS.find(l=>l.id===locId)?.name})</h3>
                  <textarea 
                    className="w-full p-3 bg-gray-50 border rounded-xl h-24 text-sm"
                    defaultValue={currentGlobalSlots}
                    onBlur={(e) => {
                        const slots = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                        firebaseService.updateSettings(locId, { timeSlots: slots });
                    }}
                  />
              </div>
          </div>
      )
  };

  const saveEdit = async () => {
      const col = editType === 'service' ? 'services' : editType === 'discount' ? 'discounts' : 'templates';
      if(editItem.id) await firebaseService.updateItem(col, editItem.id, editItem);
      else await firebaseService.addItem(col, editItem);
      setIsEditOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 fade-in">
        <div className="bg-white sticky top-0 z-20 shadow-sm">
            <div className="flex justify-between items-center p-4 border-b">
                <h2 className="font-bold text-[#5d4037]">後台管理系統</h2>
                <div className="flex gap-2">
                    {tab === 'bookings' && (
                        <button onClick={() => setShowTrash(!showTrash)} className={`text-xs px-3 py-1 rounded-full border ${showTrash ? 'bg-red-100 text-red-600 border-red-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                            <Icon name="trash" size={14}/>
                        </button>
                    )}
                    <button onClick={onBack} className="text-xs bg-gray-100 px-3 py-1 rounded-full">登出</button>
                </div>
            </div>
            <div className="flex overflow-x-auto no-scrollbar">
                {['bookings', 'services', 'settings', 'others'].map(t => (
                    <button key={t} onClick={() => { setTab(t as any); if(t!=='bookings') setShowTrash(false); }} 
                        className={`flex-1 py-3 text-sm font-bold border-b-2 whitespace-nowrap px-4 ${tab === t ? 'border-[#8d6e63] text-[#8d6e63]' : 'border-transparent text-gray-400'}`}>
                        {t === 'bookings' ? '預約管理' : t === 'services' ? '服務項目' : t === 'settings' ? '營業設定' : '其他'}
                    </button>
                ))}
            </div>
            {tab === 'bookings' && (
                <div className="flex border-b">
                     <button onClick={() => setViewMode('list')} className={`flex-1 py-2 text-xs font-bold ${viewMode === 'list' ? 'bg-gray-100 text-[#5d4037]' : 'text-gray-400'}`}>列表模式</button>
                     <button onClick={() => setViewMode('calendar')} className={`flex-1 py-2 text-xs font-bold ${viewMode === 'calendar' ? 'bg-gray-100 text-[#5d4037]' : 'text-gray-400'}`}>月曆模式</button>
                </div>
            )}
        </div>
        
        <div className="p-4">
            {tab === 'bookings' && (viewMode === 'list' ? renderBookingsList() : renderBookingsCalendar())}
            {tab === 'services' && renderServices()}
            {tab === 'settings' && (
                <div className="text-center text-gray-400 py-10">
                    {/* Re-implementing simplified settings for context */}
                    <div className="space-y-6 text-left">
                        <div className="flex bg-white p-1 rounded-xl border shadow-sm">{LOCATIONS.map(l => (<button key={l.id} onClick={() => setSettingsLoc(l.id)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${settingsLoc === l.id ? 'bg-[#5d4037] text-white shadow-md' : 'text-gray-400'}`}>{l.name}</button>))}</div>
                        <div className="bg-white p-4 rounded-2xl border"><h3 className="font-bold mb-2">預設每日時段</h3><textarea className="w-full p-3 bg-gray-50 border rounded-xl h-24 text-sm" defaultValue={settings[settingsLoc]?.timeSlots?.join(', ') || DEFAULT_SLOTS.join(', ')} onBlur={(e) => { const slots = e.target.value.split(',').map(s => s.trim()).filter(s => s); firebaseService.updateSettings(settingsLoc, { timeSlots: slots }); }} /></div>
                        <div className="text-xs text-gray-400 text-center">如需設定特定日期公休，請使用月曆功能(簡化版暫略)</div>
                    </div>
                </div>
            )}
            {tab === 'others' && (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-bold text-[#5d4037]">優惠身份</h3>
                        <Button onClick={() => { setEditItem({}); setEditType('discount'); setIsEditOpen(true); }} className="w-full text-xs py-2">新增折扣</Button>
                        {discounts.map(d => (
                             <div key={d.id} className="flex justify-between bg-white p-3 rounded border">
                                 <span>{d.name} (-${d.amount})</span>
                                 <button onClick={() => firebaseService.deleteItem('discounts', d.id)} className="text-red-400">🗑</button>
