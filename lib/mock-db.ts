import { DEFAULT_ACCENT_HEX, DEFAULT_PRIMARY_HEX } from './theme/constants';

export type UserRole = 'passenger' | 'driver' | 'admin' | 'superadmin';
export type RideStatus = 'searching' | 'matched' | 'en-route' | 'arrived' | 'in-trip' | 'completed' | 'cancelled';
export type ReservationStatus = 'pending' | 'confirmed' | 'arrived' | 'completed' | 'cancelled';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  tenantId: string;
  avatar?: string;
  rating?: number;
  completedRides?: number;
  balance?: number;
  bankAccount?: string;
}

export interface Region {
  id: string;
  name: string;
  country: string;
  logo?: string;
  primaryColor?: string;
  accentColor?: string;
  provinces: string[];
}

export interface Tenant {
  id: string;
  name: string;
  regionId: string;
  logo?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface TODATerminal {
  id: string;
  name: string;
  location: string;
  tenantId: string;
  latitude: number;
  longitude: number;
  capacity: number;
  currentQueued: number;
}

export interface Ride {
  id: string;
  tenantId: string;
  passengerId: string;
  driverId?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  status: RideStatus;
  fare: number;
  distance: number;
  estimatedDuration: number;
  actualDuration?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  rideType: 'on-demand' | 'todo-queue';
  driverLocation?: { latitude: number; longitude: number };
}

export interface Reservation {
  id: string;
  tenantId: string;
  passengerId: string;
  terminalId: string;
  boardingTime: Date;
  status: ReservationStatus;
  queuePosition: number;
  createdAt: Date;
}

export interface DriverOffer {
  id: string;
  rideId: string;
  driverId: string;
  status: OfferStatus;
  expiresAt: Date;
  createdAt: Date;
}

const regions: Region[] = [
  {
    id: 'region-1',
    name: 'Metro Manila',
    country: 'Philippines',
    logo: undefined,
    primaryColor: DEFAULT_PRIMARY_HEX,
    accentColor: DEFAULT_ACCENT_HEX,
    provinces: ['Makati', 'Taguig', 'Pasig', 'Quezon City'],
  },
  {
    id: 'region-2',
    name: 'Cebu',
    country: 'Philippines',
    logo: undefined,
    primaryColor: DEFAULT_PRIMARY_HEX,
    accentColor: DEFAULT_ACCENT_HEX,
    provinces: ['Cebu City', 'Mandaue', 'Lapu-Lapu'],
  },
];

const tenants: Tenant[] = [
  {
    id: 'tenant-makati',
    name: 'Makati Tricycle Services',
    regionId: 'region-1',
  },
  {
    id: 'tenant-taguig',
    name: 'Taguig Transport Hub',
    regionId: 'region-1',
  },
  {
    id: 'tenant-cebu',
    name: 'Cebu Mobility Solutions',
    regionId: 'region-2',
  },
];

const users: User[] = [
  {
    id: 'user-passenger-1',
    name: 'Maria Santos',
    email: 'maria@example.com',
    phone: '+63 917 123 4567',
    role: 'passenger',
    tenantId: 'tenant-makati',
    rating: 4.8,
    completedRides: 42,
    balance: 2500,
  },
  {
    id: 'user-driver-1',
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    phone: '+63 917 234 5678',
    role: 'driver',
    tenantId: 'tenant-makati',
    rating: 4.9,
    completedRides: 156,
    balance: 15800,
    bankAccount: '****1234',
  },
  {
    id: 'user-admin-1',
    name: 'Anna Rodriguez',
    email: 'admin@example.com',
    phone: '+63 917 345 6789',
    role: 'admin',
    tenantId: 'tenant-makati',
  },
  {
    id: 'user-superadmin-1',
    name: 'Admin System',
    email: 'superadmin@example.com',
    phone: '+63 917 456 7890',
    role: 'superadmin',
    tenantId: 'tenant-makati',
  },
  {
    id: 'user-passenger-2',
    name: 'Carlo Mendoza',
    email: 'carlo@example.com',
    phone: '+63 917 111 2200',
    role: 'passenger',
    tenantId: 'tenant-taguig',
    rating: 4.7,
    completedRides: 26,
    balance: 1800,
  },
  {
    id: 'user-driver-2',
    name: 'Jose Aquino',
    email: 'jose@example.com',
    phone: '+63 917 111 3300',
    role: 'driver',
    tenantId: 'tenant-taguig',
    rating: 4.8,
    completedRides: 124,
    balance: 13200,
    bankAccount: '****9081',
  },
  {
    id: 'user-admin-2',
    name: 'Liza Ramos',
    email: 'liza.admin@example.com',
    phone: '+63 917 111 4400',
    role: 'admin',
    tenantId: 'tenant-taguig',
  },
  {
    id: 'user-superadmin-2',
    name: 'Platform Lead - Taguig',
    email: 'superadmin.taguig@example.com',
    phone: '+63 917 111 5500',
    role: 'superadmin',
    tenantId: 'tenant-taguig',
  },
  {
    id: 'user-passenger-3',
    name: 'Rhea Villanueva',
    email: 'rhea@example.com',
    phone: '+63 917 222 1100',
    role: 'passenger',
    tenantId: 'tenant-cebu',
    rating: 4.9,
    completedRides: 57,
    balance: 3250,
  },
  {
    id: 'user-driver-3',
    name: 'Mark Castanares',
    email: 'mark.driver@example.com',
    phone: '+63 917 222 2200',
    role: 'driver',
    tenantId: 'tenant-cebu',
    rating: 4.9,
    completedRides: 188,
    balance: 19400,
    bankAccount: '****4472',
  },
  {
    id: 'user-admin-3',
    name: 'Celine Go',
    email: 'celine.admin@example.com',
    phone: '+63 917 222 3300',
    role: 'admin',
    tenantId: 'tenant-cebu',
  },
  {
    id: 'user-superadmin-3',
    name: 'Platform Lead - Cebu',
    email: 'superadmin.cebu@example.com',
    phone: '+63 917 222 4400',
    role: 'superadmin',
    tenantId: 'tenant-cebu',
  },
];

const terminals: TODATerminal[] = [
  {
    id: 'terminal-1',
    name: 'Makati Central Terminal',
    location: 'Makati City Hall Area',
    tenantId: 'tenant-makati',
    latitude: 14.5546,
    longitude: 121.0227,
    capacity: 50,
    currentQueued: 23,
  },
  {
    id: 'terminal-2',
    name: 'Taguig Market Terminal',
    location: 'Bonifacio Global City',
    tenantId: 'tenant-taguig',
    latitude: 14.5599,
    longitude: 121.0623,
    capacity: 40,
    currentQueued: 15,
  },
];

const rides: Ride[] = [
  {
    id: 'ride-1',
    tenantId: 'tenant-makati',
    passengerId: 'user-passenger-1',
    driverId: 'user-driver-1',
    pickupLocation: 'Makati Medical Center',
    dropoffLocation: 'SM Makati',
    pickupLatitude: 14.552,
    pickupLongitude: 121.0285,
    dropoffLatitude: 14.5536,
    dropoffLongitude: 121.0178,
    status: 'en-route',
    fare: 185,
    distance: 2.4,
    estimatedDuration: 12,
    rideType: 'on-demand',
    driverLocation: { latitude: 14.5515, longitude: 121.0225 },
    createdAt: new Date(Date.now() - 5 * 60000),
    startedAt: new Date(Date.now() - 3 * 60000),
  },
];

const reservations: Reservation[] = [
  {
    id: 'res-1',
    tenantId: 'tenant-makati',
    passengerId: 'user-passenger-1',
    terminalId: 'terminal-1',
    boardingTime: new Date(Date.now() + 2 * 3600000),
    status: 'confirmed',
    queuePosition: 5,
    createdAt: new Date(),
  },
];

export function getRegionById(id: string): Region | undefined {
  return regions.find((r) => r.id === id);
}

export function getTenantById(id: string): Tenant | undefined {
  return tenants.find((t) => t.id === id);
}

export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getRideById(id: string): Ride | undefined {
  return rides.find((r) => r.id === id);
}

export function getTenantsByRegion(regionId: string): Tenant[] {
  return tenants.filter((t) => t.regionId === regionId);
}

export function getUsersByTenant(tenantId: string, role?: UserRole): User[] {
  return users.filter((u) => u.tenantId === tenantId && (!role || u.role === role));
}

export function getRidesByTenant(tenantId: string): Ride[] {
  return rides.filter((r) => r.tenantId === tenantId);
}

export function getTerminalsByTenant(tenantId: string): TODATerminal[] {
  return terminals.filter((t) => t.tenantId === tenantId);
}

export function getReservationsByPassenger(passengerId: string): Reservation[] {
  return reservations.filter((r) => r.passengerId === passengerId);
}

export function getReservationsByTerminal(terminalId: string): Reservation[] {
  return reservations.filter((r) => r.terminalId === terminalId);
}

export const mockDB = {
  regions,
  tenants,
  users,
  terminals,
  rides,
  reservations,
  getRegionById,
  getTenantById,
  getUserById,
  getRideById,
  getTenantsByRegion,
  getUsersByTenant,
  getRidesByTenant,
  getTerminalsByTenant,
  getReservationsByPassenger,
  getReservationsByTerminal,
};
