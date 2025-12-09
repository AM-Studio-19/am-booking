export interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
  type: string;
  session?: string;
  timeRange?: string;
  isDarkLip?: boolean;
  order?: number;
  active?: boolean;
  duration?: number;
}

export interface Discount {
  id: string;
  name: string;
  amount: number;
  active?: boolean;
}

export interface Template {
  id: string;
  title: string;
  content: string;
}

export interface Location {
  id: string;
  name: string;
}

export interface Guest {
  id: number;
  name: string;
  phone: string;
  services: Service[];
  discount: Discount | null;
}

export interface BookingRecord {
  id: string;
  locationId: string;
  locationName: string;
  serviceName: string;
  serviceDuration: number;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  paymentStatus: 'unpaid' | 'reported' | 'verified';
  totalPrice: number;
  deposit: number;
  guestIndex: number;
  notes?: string;
  paymentInfo?: {
    last5: string;
    at: string;
  };
}

export interface AppSettings {
  allowedDates?: string[];
  specialRules?: Record<string, string[]>;
  timeSlots?: string[];
}
