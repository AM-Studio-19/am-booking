export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCzCXFgd7VrWHyHrM3GILQ2JHzQaa7yoIw",
  authDomain: "amstudio-booking.firebaseapp.com",
  projectId: "amstudio-booking",
  storageBucket: "amstudio-booking.firebasestorage.app",
  messagingSenderId: "197698776484",
  appId: "1:197698776484:web:818beeea66d470bfc36531"
};

export const LIFF_ID = '2008567948-KGMPJPGe';
export const APP_ID = 'booking-system-web';
export const ADMIN_PIN = '1234';

export const BANK_INFO = {
  code: '822',
  bankName: '中國信託',
  account: '1234-5678-9012',
  amountPerPerson: 1000
};

export const LOCATIONS = [
  { id: 'tainan', name: '台南工作室' },
  { id: 'kaohsiung', name: '高雄工作室' }
];

export const MAIN_CATS = ["霧眉", "霧唇"];
export const SUB_CATS = ["首次", "補色"];
export const TOUCHUP_SESSIONS = ["第一次回補", "第二次以上"];
export const DEFAULT_SLOTS = ["11:00", "13:00", "15:00", "17:00", "18:30", "微調時段申請"];

export const MOCK_SERVICES = [
  { id: '1', name: '頂級霧眉 (首次)', price: 6000, category: '霧眉', type: '首次', order: 1, duration: 120 },
  { id: '2', name: '水嫩霧唇 (首次)', price: 8000, category: '霧唇', type: '首次', order: 2, duration: 150 },
  { id: '3', name: '霧眉補色 (第一次)', price: 2000, category: '霧眉', type: '補色', session: '第一次回補', timeRange: '3個月內', duration: 90 },
  { id: '4', name: '霧唇補色 (第一次)', price: 3000, category: '霧唇', type: '補色', session: '第一次回補', timeRange: '3個月內', duration: 120 },];
