import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, writeBatch, onSnapshot, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { FIREBASE_CONFIG, APP_ID } from '../constants';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

// Collection References
const getPublicDataRef = () => doc(db, 'artifacts', APP_ID, 'public', 'data');

export const firebaseService = {
  auth,
  db,
  
  signIn: () => signInAnonymously(auth),
  
  onUserChange: (callback: (user: User | null) => void) => onAuthStateChanged(auth, callback),

  // --- Read Methods ---

  getServices: (callback: (data: any[]) => void) => {
    return onSnapshot(collection(getPublicDataRef(), 'services'), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  getDiscounts: (callback: (data: any[]) => void) => {
    return onSnapshot(collection(getPublicDataRef(), 'discounts'), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  getTemplates: (callback: (data: any[]) => void) => {
    return onSnapshot(collection(getPublicDataRef(), 'templates'), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  getSettings: (callback: (data: any) => void) => {
    return onSnapshot(collection(getPublicDataRef(), 'settings'), (snap) => {
      const settings: any = {};
      snap.forEach(d => { settings[d.id] = d.data(); });
      callback(settings);
    });
  },

  getBookingsByDate: (locationId: string, dateStr: string, callback: (bookings: any[]) => void) => {
    // Note: Removed "where('status', '!=', 'cancelled')" to avoid "Index Required" error.
    // Filtering is now done client-side below.
    const q = query(
      collection(getPublicDataRef(), 'bookings'),
      where('locationId', '==', locationId),
      where('date', '==', dateStr)
    );
    return onSnapshot(q, (snap) => {
      const bookings = snap.docs
        .map(d => d.data())
        .filter((b: any) => b.status !== 'cancelled');
      callback(bookings);
    });
  },

  getAllBookings: (callback: (bookings: any[]) => void) => {
     const q = query(collection(getPublicDataRef(), 'bookings'), orderBy('date', 'desc'), limit(300));
     return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({id: d.id, ...d.data()})));
     });
  },

  searchBookings: async (phone: string) => {
    const q = query(collection(getPublicDataRef(), 'bookings'), where('customerPhone', '==', phone));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // --- Write Methods (Client) ---

  createBookings: async (bookingsData: any[]) => {
    const batch = writeBatch(db);
    bookingsData.forEach(data => {
      const ref = doc(collection(getPublicDataRef(), 'bookings'));
      batch.set(ref, {
        ...data,
        createdAt: Timestamp.now()
      });
    });
    await batch.commit();
  },

  reportPayment: async (bookingId: string, last5: string) => {
    const ref = doc(collection(getPublicDataRef(), 'bookings'), bookingId);
    await updateDoc(ref, {
      paymentStatus: 'reported',
      paymentInfo: {
        last5,
        at: new Date().toISOString()
      }
    });
  },

  // --- Admin Write Methods ---

  updateBookingStatus: async (id: string, updates: any) => {
    await updateDoc(doc(collection(getPublicDataRef(), 'bookings'), id), updates);
  },

  addItem: async (collectionName: string, data: any) => {
    await addDoc(collection(getPublicDataRef(), collectionName), data);
  },

  updateItem: async (collectionName: string, id: string, data: any) => {
    await updateDoc(doc(collection(getPublicDataRef(), collectionName), id), data);
  },

  deleteItem: async (collectionName: string, id: string) => {
    await deleteDoc(doc(collection(getPublicDataRef(), collectionName), id));
  },

  updateSettings: async (docId: string, data: any) => {
    await setDoc(doc(collection(getPublicDataRef(), 'settings'), docId), data, { merge: true });
  }
};
