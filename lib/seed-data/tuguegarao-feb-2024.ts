import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient, type Tenant, type User } from '@prisma/client';
import { BOOKING_FARE } from '../booking/constants';
import { ensureDriverProfileForUser, resolveDriverOperationalState } from '../driver-domain';

export const TUGUE_SEED_NAMESPACE = 'seed-tugue-feb-2024';
export const TUGUE_TENANT_ID = stableOpaqueId('tenant', 'tuguegarao-city');

const TUGUE_FEB_START = new Date('2024-02-01T00:00:00+08:00');
const TUGUE_FEB_END = new Date('2024-02-29T23:59:59.999+08:00');

const LEGACY_DEV_SEED_IDS = {
  tenantAdmin: 'user-admin-tuguegarao-city',
  driver: 'user-driver-tuguegarao-city',
  passenger: 'user-passenger-global',
  terminal: 'terminal-tuguegarao-central',
} as const;

type AuthProvisioner = (email: string, password: string) => Promise<{ id: string; email: string }>;

type StaffRoleKey = 'tenant_owner' | 'tenant_admin' | 'dispatcher' | 'reports_viewer';
type DriverStateKey = 'verified-online' | 'verified-offline' | 'pending' | 'restricted';
type PlaceGroup =
  | 'residential'
  | 'school'
  | 'hospital'
  | 'church'
  | 'market'
  | 'mall'
  | 'terminal'
  | 'government'
  | 'business';
type RidePatternKey = 'morning-commute' | 'lunch-movement' | 'afternoon-rush' | 'evening-return' | 'weekend-errand';

interface SeedSummary {
  credentials: Array<{
    label: string;
    email: string;
    password: string;
    roleKey: StaffRoleKey;
    isActive: boolean;
  }>;
  counts: Record<string, number>;
  tenant: {
    id: string;
    name: string;
  };
}

interface StaffSeedSpec {
  id: string;
  label: string;
  name: string;
  email: string;
  password: string;
  roleKey: StaffRoleKey;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
}

interface TerminalSeedSpec {
  id: string;
  key: string;
  code: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PassengerSeedSpec {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  balance: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DriverSeedSpec {
  id: string;
  key: string;
  name: string;
  phone: string;
  email: string;
  rating: number;
  state: DriverStateKey;
  terminalKey: string;
  homeAddress: string;
  todaMembershipId: string;
  licenseNumber: string;
  licenseExpiry: Date;
  vehicleType: string;
  plateNumber: string;
  vehicleModel: string;
  vehicleColor: string;
  createdAt: Date;
  updatedAt: Date;
  verificationReviewedAt: Date | null;
  rejectedReviewAt: Date | null;
  rejectedReviewRemarks: string | null;
  restrictionReason: string | null;
  restrictedAt: Date | null;
  historicalRestriction: {
    restrictedAt: Date;
    reinstatedAt: Date;
    reason: string;
  } | null;
  lastHeartbeatAt: Date;
  onlineSinceAt: Date | null;
  latitude: number | null;
  longitude: number | null;
}

interface Place {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  groups: PlaceGroup[];
}

interface RideSlot {
  id: string;
  createdAt: Date;
  pattern: RidePatternKey;
  status: 'completed' | 'cancelled';
  passengerIndex: number;
  driverKey: string | null;
}

interface RideSeedRecord extends Prisma.RideCreateManyInput {
  id: string;
}

interface ReservationSeedRecord extends Prisma.ReservationCreateManyInput {
  id: string;
}

interface ReviewSeedRecord extends Prisma.DriverVerificationReviewCreateManyInput {
  id: string;
}

interface RestrictionLogSeedRecord extends Prisma.DriverRestrictionLogCreateManyInput {
  id: string;
}

interface DriverDocumentSeedRecord extends Prisma.DriverDocumentCreateManyInput {
  id: string;
}

interface AuditLogSeedRecord extends Prisma.TenantAuditLogCreateManyInput {
  id: string;
}

interface SupportAccessSeedRecord extends Prisma.SupportAccessLogCreateManyInput {
  id: string;
}

const STAFF_ACCOUNT_BASE: Array<Omit<StaffSeedSpec, 'email'>> = [
  {
    id: stableOpaqueId('user', 'staff-owner'),
    label: 'Tenant Owner',
    name: 'Rosario Mae Alcantara',
    password: 'Mobility!Owner2024',
    roleKey: 'tenant_owner',
    isActive: true,
    createdAt: manilaDate(1, 8, 10),
    updatedAt: manilaDate(24, 10, 15),
    deactivatedAt: null,
  },
  {
    id: stableOpaqueId('user', 'staff-admin'),
    label: 'Tenant Admin',
    name: 'Marc Eugene Villaflor',
    password: 'Mobility!Admin2024',
    roleKey: 'tenant_admin',
    isActive: true,
    createdAt: manilaDate(1, 8, 20),
    updatedAt: manilaDate(26, 9, 45),
    deactivatedAt: null,
  },
  {
    id: stableOpaqueId('user', 'staff-dispatcher'),
    label: 'Dispatcher',
    name: 'Leah Joy Briones',
    password: 'Mobility!Dispatch2024',
    roleKey: 'dispatcher',
    isActive: true,
    createdAt: manilaDate(5, 7, 30),
    updatedAt: manilaDate(28, 7, 5),
    deactivatedAt: null,
  },
  {
    id: stableOpaqueId('user', 'staff-reports'),
    label: 'Reports Viewer',
    name: 'Noel Patrick Rigor',
    password: 'Mobility!Reports2024',
    roleKey: 'reports_viewer',
    isActive: false,
    createdAt: manilaDate(7, 9, 0),
    updatedAt: manilaDate(27, 16, 20),
    deactivatedAt: manilaDate(27, 16, 20),
  },
] as const;

const TERMINAL_SPECS: readonly TerminalSeedSpec[] = [
  {
    id: stableOpaqueId('terminal', 'centro'),
    key: 'centro',
    code: 'CEN',
    name: 'Centro Rizal TODA Terminal',
    location: 'City Hall - Rizal Street, Centro 10',
    latitude: 17.6136,
    longitude: 121.7268,
    capacity: 26,
    createdAt: manilaDate(1, 5, 30),
    updatedAt: manilaDate(29, 6, 40),
  },
  {
    id: stableOpaqueId('terminal', 'caritan'),
    key: 'caritan',
    code: 'CAR',
    name: 'Caritan Market TODA Terminal',
    location: 'Caritan Public Market',
    latitude: 17.6213,
    longitude: 121.7231,
    capacity: 22,
    createdAt: manilaDate(1, 5, 45),
    updatedAt: manilaDate(29, 6, 45),
  },
  {
    id: stableOpaqueId('terminal', 'ugac'),
    key: 'ugac',
    code: 'UGA',
    name: 'Ugac Sur Junction TODA Terminal',
    location: 'Ugac Sur Barangay Hall',
    latitude: 17.6021,
    longitude: 121.7346,
    capacity: 18,
    createdAt: manilaDate(2, 5, 20),
    updatedAt: manilaDate(29, 6, 50),
  },
  {
    id: stableOpaqueId('terminal', 'caggay'),
    key: 'caggay',
    code: 'CAG',
    name: 'Caggay Riverside TODA Terminal',
    location: 'Caggay Road near Riverside Homes',
    latitude: 17.5911,
    longitude: 121.7334,
    capacity: 20,
    createdAt: manilaDate(2, 5, 40),
    updatedAt: manilaDate(29, 6, 55),
  },
] as const;

const TUGUE_PLACES: readonly Place[] = [
  { id: 'city-hall', label: 'Tuguegarao City Hall', latitude: 17.6138, longitude: 121.7266, groups: ['government', 'business'] },
  { id: 'uslt-main-gate', label: 'University of Saint Louis Main Gate', latitude: 17.6149, longitude: 121.7308, groups: ['school', 'business'] },
  { id: 'st-peter-cathedral', label: 'St. Peter Metropolitan Cathedral', latitude: 17.6135, longitude: 121.7281, groups: ['church', 'business'] },
  { id: 'sm-downtown', label: 'SM Center Tuguegarao Downtown', latitude: 17.6155, longitude: 121.7318, groups: ['mall', 'business'] },
  { id: 'victory-liner', label: 'Victory Liner Tuguegarao Terminal', latitude: 17.6145, longitude: 121.7346, groups: ['terminal', 'business'] },
  { id: 'cvmc', label: 'Cagayan Valley Medical Center', latitude: 17.6262, longitude: 121.7292, groups: ['hospital', 'business'] },
  { id: 'caritan-market', label: 'Caritan Public Market', latitude: 17.6215, longitude: 121.7238, groups: ['market', 'business'] },
  { id: 'csu-andrews', label: 'CSU Andrews Campus', latitude: 17.6576, longitude: 121.7327, groups: ['school'] },
  { id: 'csu-carig', label: 'CSU Carig Campus', latitude: 17.6612, longitude: 121.7396, groups: ['school'] },
  { id: 'robinsons', label: 'Robinsons Place Tuguegarao', latitude: 17.6504, longitude: 121.7347, groups: ['mall', 'business'] },
  { id: 'peoples-gym', label: "People's Gym", latitude: 17.6088, longitude: 121.7272, groups: ['government', 'business'] },
  { id: 'bagay-boarding', label: 'Bagay Road Boarding Houses', latitude: 17.6234, longitude: 121.7385, groups: ['residential'] },
  { id: 'ugac-hall', label: 'Ugac Sur Barangay Hall', latitude: 17.6021, longitude: 121.7349, groups: ['residential', 'government'] },
  { id: 'caggay-homes', label: 'Caggay Riverside Homes', latitude: 17.5912, longitude: 121.7337, groups: ['residential'] },
  { id: 'annafunan-east', label: 'Annafunan East Elementary Gate', latitude: 17.6325, longitude: 121.7395, groups: ['school', 'residential'] },
  { id: 'buntun-homes', label: 'Buntun Highway Homes', latitude: 17.6415, longitude: 121.7057, groups: ['residential'] },
  { id: 'dalin-terminal', label: 'Dalin Bus Terminal', latitude: 17.6168, longitude: 121.7373, groups: ['terminal', 'business'] },
  { id: 'commercial-center', label: 'Tuguegarao Commercial Center', latitude: 17.6207, longitude: 121.7249, groups: ['market', 'business'] },
  { id: 'st-paul', label: 'St. Paul University Philippines', latitude: 17.6141, longitude: 121.7328, groups: ['school'] },
  { id: 'divine-mercy-clinic', label: 'Divine Mercy Clinic', latitude: 17.6189, longitude: 121.7298, groups: ['hospital'] },
  { id: 'bagumbayan-stop', label: 'Bagumbayan Transport Stop', latitude: 17.6104, longitude: 121.7246, groups: ['terminal', 'business'] },
  { id: 'regional-science', label: 'Regional Science High School Gate', latitude: 17.6468, longitude: 121.7447, groups: ['school'] },
] as const;

const PLACE_GROUPS: Record<PlaceGroup, Place[]> = {
  residential: TUGUE_PLACES.filter((place) => place.groups.includes('residential')),
  school: TUGUE_PLACES.filter((place) => place.groups.includes('school')),
  hospital: TUGUE_PLACES.filter((place) => place.groups.includes('hospital')),
  church: TUGUE_PLACES.filter((place) => place.groups.includes('church')),
  market: TUGUE_PLACES.filter((place) => place.groups.includes('market')),
  mall: TUGUE_PLACES.filter((place) => place.groups.includes('mall')),
  terminal: TUGUE_PLACES.filter((place) => place.groups.includes('terminal')),
  government: TUGUE_PLACES.filter((place) => place.groups.includes('government')),
  business: TUGUE_PLACES.filter((place) => place.groups.includes('business')),
};

const PASSENGER_NAMES = [
  'Alyssa Mae Dacumos',
  'Jerson Paolo Navarro',
  'Claire Ann Malunes',
  'Mark Neil Agbayani',
  'Trina Louise Bumatay',
  'Kevin Joshua Bartolome',
  'Hazel Marie Sarmiento',
  'Nicole Therese Abao',
  'Renzo Miguel Aquino',
  'Patricia Anne Jarin',
  'Jolina Mae Camba',
  'Francis Elmer Pallagao',
  'Charlene Faith Maturan',
  'Rafi Angelo Mendiola',
  'Joanica Rose Casibang',
  'Gerald Vincent Parba',
  'Krisha Mae Lising',
  'Ian Lester Tumaliuan',
  'Denise Mae Corpuz',
  'Kyle Adrian Fajardo',
  'Shaira Joy Malubay',
  'Lester Carl Acorda',
  'Pauline Grace Panaligan',
  'Arvin James Calica',
] as const;

const EMERGENCY_CONTACT_NAMES = [
  'Marites Dacumos',
  'Rodolfo Navarro',
  'Evelyn Malunes',
  'Ramil Agbayani',
  'Nerissa Bumatay',
  'Wilfredo Bartolome',
  'Gemma Sarmiento',
  'Roselyn Abao',
  'Eduardo Aquino',
  'Lourdes Jarin',
  'Myla Camba',
  'Arnel Pallagao',
  'Belen Maturan',
  'Danilo Mendiola',
  'Celeste Casibang',
  'Edwin Parba',
  'Julieta Lising',
  'Arnold Tumaliuan',
  'Liza Corpuz',
  'Roland Fajardo',
  'Mylene Malubay',
  'Benhur Acorda',
  'Vilma Panaligan',
  'Jerome Calica',
] as const;

const DRIVER_BASE_SPECS = [
  { key: 'driver-01', name: 'Ronaldo Cayanan Baccay', state: 'verified-online', terminalKey: 'centro', homeAddress: 'Purok 2, Centro 8, Tuguegarao City', todaMembershipId: 'CEN-114' },
  { key: 'driver-02', name: 'Teodoro Mabbayad Luzon', state: 'verified-online', terminalKey: 'caritan', homeAddress: 'Purok 3, Caritan Norte, Tuguegarao City', todaMembershipId: 'CAR-207' },
  { key: 'driver-03', name: 'Rico Martin Acosta', state: 'verified-online', terminalKey: 'ugac', homeAddress: 'Purok 5, Ugac Sur, Tuguegarao City', todaMembershipId: 'UGA-061' },
  { key: 'driver-04', name: 'Benjie Orpilla Tanggol', state: 'verified-online', terminalKey: 'caggay', homeAddress: 'Block 4, Caggay Riverside Homes, Tuguegarao City', todaMembershipId: 'CAG-082' },
  { key: 'driver-05', name: 'Joel Mariano Dalisay', state: 'verified-offline', terminalKey: 'centro', homeAddress: 'Centro 4, near Bagumbayan, Tuguegarao City', todaMembershipId: 'CEN-129' },
  { key: 'driver-06', name: 'Orlando Villacorta Delao', state: 'verified-offline', terminalKey: 'caritan', homeAddress: 'Purok 1, Caritan Centro, Tuguegarao City', todaMembershipId: 'CAR-214' },
  { key: 'driver-07', name: 'Nestor Pascual Panotes', state: 'verified-offline', terminalKey: 'ugac', homeAddress: 'Purok 6, Ugac Norte, Tuguegarao City', todaMembershipId: 'UGA-073' },
  { key: 'driver-08', name: 'Crisanto Mallari Gammad', state: 'verified-offline', terminalKey: 'caggay', homeAddress: 'Phase 2, Caggay Riverside, Tuguegarao City', todaMembershipId: 'CAG-095' },
  { key: 'driver-09', name: 'Ramon Ulep Salazar', state: 'verified-offline', terminalKey: 'centro', homeAddress: 'Purok 4, Centro 10, Tuguegarao City', todaMembershipId: 'CEN-136' },
  { key: 'driver-10', name: 'Jeffrey Mangaoang Lazo', state: 'verified-offline', terminalKey: 'caritan', homeAddress: 'Purok 2, Caritan Sur, Tuguegarao City', todaMembershipId: 'CAR-231' },
  { key: 'driver-11', name: 'Alvin Ulep Bumatay', state: 'verified-offline', terminalKey: 'ugac', homeAddress: 'Purok 7, Ugac Norte, Tuguegarao City', todaMembershipId: 'UGA-085' },
  { key: 'driver-12', name: 'Daniel Asuncion Mijares', state: 'pending', terminalKey: 'centro', homeAddress: 'Purok 5, Centro 11, Tuguegarao City', todaMembershipId: 'CEN-142' },
  { key: 'driver-13', name: 'Percy Sabalvaro Tolentino', state: 'pending', terminalKey: 'caggay', homeAddress: 'Purok 1, Caggay, Tuguegarao City', todaMembershipId: 'CAG-104' },
  { key: 'driver-14', name: 'Leopoldo Alviar Nagrama', state: 'pending', terminalKey: 'ugac', homeAddress: 'Purok 3, Ugac Sur, Tuguegarao City', todaMembershipId: 'UGA-098' },
  { key: 'driver-15', name: 'Marvin Lucero Battung', state: 'restricted', terminalKey: 'caritan', homeAddress: 'Purok 6, Caritan East, Tuguegarao City', todaMembershipId: 'CAR-245' },
  { key: 'driver-16', name: 'Edgar Dela Cruz Pinili', state: 'restricted', terminalKey: 'centro', homeAddress: 'Purok 3, Centro 9, Tuguegarao City', todaMembershipId: 'CEN-151' },
] as const;

const VEHICLE_MODELS = ['Bajaj RE', 'TVS King Deluxe', 'Honda TMX 125 Alpha', 'Kawasaki Barako II'] as const;
const VEHICLE_COLORS = ['Blue', 'Red', 'Green', 'Silver', 'Yellow', 'White'] as const;

const RIDE_PATTERN_PAIR_IDS: Record<RidePatternKey, readonly [string, string][]> = {
  'morning-commute': [
    ['caggay-homes', 'uslt-main-gate'],
    ['ugac-hall', 'city-hall'],
    ['bagay-boarding', 'st-paul'],
    ['buntun-homes', 'cvmc'],
    ['annafunan-east', 'commercial-center'],
  ],
  'lunch-movement': [
    ['uslt-main-gate', 'sm-downtown'],
    ['city-hall', 'commercial-center'],
    ['cvmc', 'caritan-market'],
    ['st-paul', 'sm-downtown'],
    ['csu-andrews', 'robinsons'],
  ],
  'afternoon-rush': [
    ['caritan-market', 'ugac-hall'],
    ['cvmc', 'bagay-boarding'],
    ['city-hall', 'victory-liner'],
    ['commercial-center', 'annafunan-east'],
    ['peoples-gym', 'caggay-homes'],
  ],
  'evening-return': [
    ['city-hall', 'caggay-homes'],
    ['uslt-main-gate', 'bagay-boarding'],
    ['sm-downtown', 'ugac-hall'],
    ['commercial-center', 'buntun-homes'],
    ['cvmc', 'annafunan-east'],
  ],
  'weekend-errand': [
    ['st-peter-cathedral', 'caritan-market'],
    ['caggay-homes', 'robinsons'],
    ['ugac-hall', 'st-peter-cathedral'],
    ['buntun-homes', 'sm-downtown'],
    ['bagay-boarding', 'city-hall'],
  ],
};

const HISTORICAL_RIDE_SLOTS: readonly RideSlot[] = [
  { id: `${TUGUE_SEED_NAMESPACE}-ride-001`, createdAt: manilaDate(1, 7, 10), pattern: 'morning-commute', status: 'completed', passengerIndex: 0, driverKey: 'driver-01' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-002`, createdAt: manilaDate(1, 12, 5), pattern: 'lunch-movement', status: 'completed', passengerIndex: 1, driverKey: 'driver-05' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-003`, createdAt: manilaDate(2, 17, 20), pattern: 'evening-return', status: 'cancelled', passengerIndex: 2, driverKey: null },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-004`, createdAt: manilaDate(3, 7, 25), pattern: 'morning-commute', status: 'completed', passengerIndex: 3, driverKey: 'driver-02' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-005`, createdAt: manilaDate(4, 11, 35), pattern: 'lunch-movement', status: 'cancelled', passengerIndex: 4, driverKey: 'driver-06' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-006`, createdAt: manilaDate(5, 16, 50), pattern: 'afternoon-rush', status: 'completed', passengerIndex: 5, driverKey: 'driver-03' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-007`, createdAt: manilaDate(6, 7, 40), pattern: 'morning-commute', status: 'completed', passengerIndex: 6, driverKey: 'driver-07' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-008`, createdAt: manilaDate(7, 12, 25), pattern: 'lunch-movement', status: 'completed', passengerIndex: 7, driverKey: 'driver-04' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-009`, createdAt: manilaDate(8, 18, 5), pattern: 'evening-return', status: 'cancelled', passengerIndex: 8, driverKey: 'driver-08' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-010`, createdAt: manilaDate(9, 8, 15), pattern: 'morning-commute', status: 'completed', passengerIndex: 9, driverKey: 'driver-09' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-011`, createdAt: manilaDate(10, 14, 10), pattern: 'weekend-errand', status: 'completed', passengerIndex: 10, driverKey: 'driver-10' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-012`, createdAt: manilaDate(11, 9, 45), pattern: 'weekend-errand', status: 'cancelled', passengerIndex: 11, driverKey: null },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-013`, createdAt: manilaDate(12, 16, 25), pattern: 'afternoon-rush', status: 'completed', passengerIndex: 12, driverKey: 'driver-11' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-014`, createdAt: manilaDate(13, 7, 35), pattern: 'morning-commute', status: 'completed', passengerIndex: 13, driverKey: 'driver-01' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-015`, createdAt: manilaDate(14, 12, 20), pattern: 'lunch-movement', status: 'completed', passengerIndex: 0, driverKey: 'driver-05' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-016`, createdAt: manilaDate(15, 17, 40), pattern: 'evening-return', status: 'completed', passengerIndex: 1, driverKey: 'driver-15' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-017`, createdAt: manilaDate(16, 8, 5), pattern: 'morning-commute', status: 'cancelled', passengerIndex: 2, driverKey: 'driver-02' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-018`, createdAt: manilaDate(17, 15, 15), pattern: 'weekend-errand', status: 'completed', passengerIndex: 3, driverKey: 'driver-08' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-019`, createdAt: manilaDate(18, 10, 50), pattern: 'weekend-errand', status: 'completed', passengerIndex: 4, driverKey: 'driver-03' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-020`, createdAt: manilaDate(19, 7, 55), pattern: 'morning-commute', status: 'completed', passengerIndex: 5, driverKey: 'driver-16' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-021`, createdAt: manilaDate(20, 12, 40), pattern: 'lunch-movement', status: 'cancelled', passengerIndex: 6, driverKey: null },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-022`, createdAt: manilaDate(21, 17, 15), pattern: 'evening-return', status: 'completed', passengerIndex: 7, driverKey: 'driver-04' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-023`, createdAt: manilaDate(22, 7, 20), pattern: 'morning-commute', status: 'completed', passengerIndex: 8, driverKey: 'driver-06' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-024`, createdAt: manilaDate(22, 17, 58), pattern: 'evening-return', status: 'completed', passengerIndex: 9, driverKey: 'driver-07' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-025`, createdAt: manilaDate(23, 11, 55), pattern: 'lunch-movement', status: 'completed', passengerIndex: 10, driverKey: 'driver-10' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-026`, createdAt: manilaDate(24, 8, 10), pattern: 'weekend-errand', status: 'completed', passengerIndex: 11, driverKey: 'driver-09' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-027`, createdAt: manilaDate(24, 16, 30), pattern: 'weekend-errand', status: 'completed', passengerIndex: 12, driverKey: 'driver-11' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-028`, createdAt: manilaDate(25, 18, 10), pattern: 'weekend-errand', status: 'cancelled', passengerIndex: 13, driverKey: 'driver-15' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-029`, createdAt: manilaDate(26, 7, 30), pattern: 'morning-commute', status: 'completed', passengerIndex: 0, driverKey: 'driver-01' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-030`, createdAt: manilaDate(27, 12, 15), pattern: 'lunch-movement', status: 'completed', passengerIndex: 1, driverKey: 'driver-05' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-031`, createdAt: manilaDate(27, 17, 25), pattern: 'evening-return', status: 'completed', passengerIndex: 2, driverKey: 'driver-03' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-032`, createdAt: manilaDate(28, 8, 35), pattern: 'morning-commute', status: 'completed', passengerIndex: 3, driverKey: 'driver-06' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-033`, createdAt: manilaDate(28, 16, 45), pattern: 'afternoon-rush', status: 'completed', passengerIndex: 4, driverKey: 'driver-08' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-034`, createdAt: manilaDate(29, 6, 55), pattern: 'morning-commute', status: 'cancelled', passengerIndex: 5, driverKey: null },
] as const;

const ACTIVE_RIDE_SPECS = [
  { id: `${TUGUE_SEED_NAMESPACE}-ride-035`, createdAt: manilaDate(29, 7, 45), pattern: 'morning-commute' as const, status: 'searching' as const, passengerIndex: 14, driverKey: null, terminalKey: 'centro' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-036`, createdAt: manilaDate(29, 8, 5), pattern: 'morning-commute' as const, status: 'searching' as const, passengerIndex: 15, driverKey: null, terminalKey: 'caritan' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-037`, createdAt: manilaDate(29, 8, 18), pattern: 'morning-commute' as const, status: 'matched' as const, passengerIndex: 16, driverKey: 'driver-01', terminalKey: 'centro' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-038`, createdAt: manilaDate(29, 17, 6), pattern: 'evening-return' as const, status: 'en_route' as const, passengerIndex: 17, driverKey: 'driver-02', terminalKey: 'caritan' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-039`, createdAt: manilaDate(29, 17, 32), pattern: 'evening-return' as const, status: 'arrived' as const, passengerIndex: 18, driverKey: 'driver-03', terminalKey: 'ugac' },
  { id: `${TUGUE_SEED_NAMESPACE}-ride-040`, createdAt: manilaDate(29, 18, 14), pattern: 'evening-return' as const, status: 'in_trip' as const, passengerIndex: 19, driverKey: 'driver-04', terminalKey: 'caggay' },
] as const;

const RESERVATION_BASE_SPECS = [
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-001`, passengerIndex: 0, terminalKey: 'centro', status: 'completed' as const, queuePosition: 1, createdAt: manilaDate(2, 6, 40), boardingTime: manilaDate(2, 7, 0), updatedAt: manilaDate(2, 7, 18) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-002`, passengerIndex: 1, terminalKey: 'caritan', status: 'completed' as const, queuePosition: 1, createdAt: manilaDate(4, 8, 10), boardingTime: manilaDate(4, 8, 25), updatedAt: manilaDate(4, 8, 44) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-003`, passengerIndex: 2, terminalKey: 'centro', status: 'completed' as const, queuePosition: 1, createdAt: manilaDate(6, 11, 50), boardingTime: manilaDate(6, 12, 5), updatedAt: manilaDate(6, 12, 27) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-004`, passengerIndex: 3, terminalKey: 'ugac', status: 'completed' as const, queuePosition: 1, createdAt: manilaDate(11, 16, 5), boardingTime: manilaDate(11, 16, 20), updatedAt: manilaDate(11, 16, 41) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-005`, passengerIndex: 4, terminalKey: 'caggay', status: 'completed' as const, queuePosition: 1, createdAt: manilaDate(15, 7, 20), boardingTime: manilaDate(15, 7, 35), updatedAt: manilaDate(15, 7, 56) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-006`, passengerIndex: 5, terminalKey: 'caritan', status: 'completed' as const, queuePosition: 2, createdAt: manilaDate(18, 17, 10), boardingTime: manilaDate(18, 17, 25), updatedAt: manilaDate(18, 17, 46) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-007`, passengerIndex: 6, terminalKey: 'centro', status: 'completed' as const, queuePosition: 3, createdAt: manilaDate(23, 9, 45), boardingTime: manilaDate(23, 10, 0), updatedAt: manilaDate(23, 10, 18) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-008`, passengerIndex: 7, terminalKey: 'centro', status: 'cancelled' as const, queuePosition: 2, createdAt: manilaDate(9, 8, 30), boardingTime: manilaDate(9, 8, 45), updatedAt: manilaDate(9, 8, 36) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-009`, passengerIndex: 8, terminalKey: 'caritan', status: 'cancelled' as const, queuePosition: 1, createdAt: manilaDate(20, 6, 55), boardingTime: manilaDate(20, 7, 10), updatedAt: manilaDate(20, 7, 2) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-010`, passengerIndex: 9, terminalKey: 'ugac', status: 'cancelled' as const, queuePosition: 1, createdAt: manilaDate(27, 17, 40), boardingTime: manilaDate(27, 17, 55), updatedAt: manilaDate(27, 17, 48) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-011`, passengerIndex: 10, terminalKey: 'centro', status: 'arrived' as const, queuePosition: 1, createdAt: manilaDate(29, 7, 55), boardingTime: manilaDate(29, 8, 10), updatedAt: manilaDate(29, 8, 20) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-012`, passengerIndex: 11, terminalKey: 'centro', status: 'confirmed' as const, queuePosition: 2, createdAt: manilaDate(29, 8, 2), boardingTime: manilaDate(29, 8, 18), updatedAt: manilaDate(29, 8, 2) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-013`, passengerIndex: 12, terminalKey: 'caritan', status: 'confirmed' as const, queuePosition: 1, createdAt: manilaDate(29, 8, 48), boardingTime: manilaDate(29, 9, 5), updatedAt: manilaDate(29, 8, 48) },
  { id: `${TUGUE_SEED_NAMESPACE}-reservation-014`, passengerIndex: 13, terminalKey: 'ugac', status: 'confirmed' as const, queuePosition: 1, createdAt: manilaDate(29, 17, 28), boardingTime: manilaDate(29, 17, 45), updatedAt: manilaDate(29, 17, 28) },
] as const;

const ACTIVE_PASSENGER_RIDE_STATUS_SET = new Set(['searching', 'matched', 'en_route', 'arrived', 'in_trip']);
const ACTIVE_DRIVER_RIDE_STATUS_SET = new Set(['matched', 'en_route', 'arrived', 'in_trip']);
const ACTIVE_RESERVATION_STATUS_SET = new Set(['confirmed', 'arrived']);
const TUGUE_STAFF_EMAIL_STEM = 'tuguegaraocity.mobility';

export async function seedTuguegaraoFebruary2024(params: {
  prisma: PrismaClient;
  tenant: Tenant;
  superadminUserId: string;
  authProvisioner: AuthProvisioner;
  adminEmailDomain: string;
}): Promise<SeedSummary> {
  const { prisma, tenant, superadminUserId, authProvisioner, adminEmailDomain } = params;
  const rng = createSeededRng(20240229);
  const staffSpecs = buildStaffSpecs(adminEmailDomain);
  const passengerSpecs = buildPassengerSpecs(rng);
  const driverSpecs = buildDriverSpecs();

  const staffAuthRecords = await Promise.all(
    staffSpecs.map(async (spec) => ({
      spec,
      auth: await authProvisioner(spec.email, spec.password),
    }))
  );

  await cleanupExistingSeed({
    prisma,
    staffSpecs,
    passengerSpecs,
    driverSpecs,
  });

  const terminalMap = await seedTerminals(prisma, tenant.id);
  const staffUsers = await seedTenantStaff(prisma, tenant.id, staffAuthRecords);
  const passengerUsers = await seedPassengers(prisma, tenant.id, passengerSpecs);
  const seededDrivers = await seedDrivers(prisma, tenant.id, driverSpecs, terminalMap, staffUsers.admin.id);

  const rideRecords = buildRideRecords(tenant.id, passengerUsers, seededDrivers, terminalMap, rng);
  await prisma.ride.createMany({ data: rideRecords });

  const reservationRecords = buildReservationRecords(tenant.id, passengerUsers, terminalMap);
  await prisma.reservation.createMany({ data: reservationRecords });

  const tenantAuditLogs = buildTenantAuditLogs(tenant.id, staffUsers, seededDrivers, terminalMap);
  await prisma.tenantAuditLog.createMany({ data: tenantAuditLogs });

  const supportAccessLogs = buildSupportAccessLogs(tenant.id, superadminUserId);
  await prisma.supportAccessLog.createMany({ data: supportAccessLogs });

  await reconcileRideCounters(prisma, passengerSpecs, driverSpecs, rideRecords);
  await recomputeTerminalQueues(prisma, terminalMap);

  const counts = {
    Tenant: 1,
    User: staffSpecs.length + passengerSpecs.length + driverSpecs.length,
    TenantMembership: staffSpecs.length,
    TODATerminal: TERMINAL_SPECS.length,
    DriverProfile: driverSpecs.length,
    DriverDocument: seededDrivers.documentCount,
    DriverVerificationReview: seededDrivers.reviewCount,
    DriverRestrictionLog: seededDrivers.restrictionLogCount,
    DriverPresence: driverSpecs.length,
    Ride: rideRecords.length,
    Reservation: reservationRecords.length,
    TenantAuditLog: tenantAuditLogs.length,
    SupportAccessLog: supportAccessLogs.length,
  } satisfies Record<string, number>;

  await verifySeed(prisma, {
    passengerSpecs,
    driverSpecs,
    rideIds: rideRecords.map((ride) => ride.id),
    reservationIds: reservationRecords.map((reservation) => reservation.id),
    auditLogIds: tenantAuditLogs.map((log) => log.id),
    supportLogIds: supportAccessLogs.map((log) => log.id),
    counts,
  });

  return {
    credentials: staffSpecs.map((spec) => ({
      label: spec.label,
      email: spec.email,
      password: spec.password,
      roleKey: spec.roleKey,
      isActive: spec.isActive,
    })),
    counts,
    tenant: {
      id: tenant.id,
      name: tenant.name,
    },
  };
}

function buildStaffSpecs(adminEmailDomain: string): StaffSeedSpec[] {
  const publicEmailDomain = resolvePublicSeedEmailDomain(adminEmailDomain);
  const localPartByRole: Record<StaffRoleKey, string> = {
    tenant_owner: `owner.${TUGUE_STAFF_EMAIL_STEM}`,
    tenant_admin: `admin.${TUGUE_STAFF_EMAIL_STEM}`,
    dispatcher: `dispatcher.${TUGUE_STAFF_EMAIL_STEM}`,
    reports_viewer: `reports.${TUGUE_STAFF_EMAIL_STEM}`,
  };

  return STAFF_ACCOUNT_BASE.map((base) => ({
    ...base,
    email: `${localPartByRole[base.roleKey]}@${publicEmailDomain}`,
  }));
}

function buildPassengerSpecs(rng: () => number): PassengerSeedSpec[] {
  return PASSENGER_NAMES.map((name, index) => ({
    id: stableOpaqueId('user', `passenger-${String(index + 1).padStart(2, '0')}`),
    name,
    phone: buildPhilippineMobile('passenger', index),
    email: index % 3 !== 1 ? buildPersonalEmail(name, index, 'passenger') : null,
    emergencyContactName: EMERGENCY_CONTACT_NAMES[index] ?? `Emergency Contact ${index + 1}`,
    emergencyContactPhone: buildPhilippineMobile('emergency', index),
    balance: roundMoney(30 + rng() * 170),
    rating: roundRating(4.65 + (index % 6) * 0.05),
    createdAt: manilaDate(1 + (index % 8), 8 + (index % 4), 5 + (index * 7) % 40),
    updatedAt: manilaDate(18 + (index % 10), 9 + (index % 5), 10 + (index * 11) % 45),
  }));
}

function buildDriverSpecs(): DriverSeedSpec[] {
  return DRIVER_BASE_SPECS.map((base, index) => {
    const terminal = TERMINAL_SPECS.find((item) => item.key === base.terminalKey);
    assert(terminal, `Missing terminal for driver seed: ${base.key}`);
    const isVerified = base.state !== 'pending';
    const isRestricted = base.state === 'restricted';
    const isOnline = base.state === 'verified-online';
    const verifiedAt = isVerified ? manilaDate(6 + (index % 8), 10 + (index % 3), 15) : null;
    const rejectedAt = base.state === 'pending' && index < 14 ? manilaDate(18 + (index % 2), 14, 20 + index) : null;
    const restrictionReason =
      base.state === 'restricted'
        ? index % 2 === 0
          ? 'Operating outside assigned terminal without dispatcher clearance.'
          : 'Pending incident review after repeated no-show reports.'
        : null;
    const restrictedAt = isRestricted ? manilaDate(24 + (index % 2), 16, 10 + index) : null;
    const lastHeartbeatAt = isOnline ? manilaDate(29, 18, 5 + index) : manilaDate(28 + (index % 2), 9 + (index % 5), 4 + index);
    const onlineSinceAt = isOnline ? addMinutes(lastHeartbeatAt, -18 - index) : null;

    return {
      id: stableOpaqueId('user', base.key),
      key: base.key,
      name: base.name,
      phone: buildPhilippineMobile('driver', index),
      email: buildPersonalEmail(base.name, index, 'driver'),
      rating: roundRating(4.72 + (index % 5) * 0.04),
      state: base.state,
      terminalKey: base.terminalKey,
      homeAddress: base.homeAddress,
      todaMembershipId: base.todaMembershipId,
      licenseNumber: `N02-24-${String(530001 + index).padStart(6, '0')}`,
      licenseExpiry: new Date(`2027-0${(index % 8) + 1}-28T00:00:00+08:00`),
      vehicleType: 'Tricycle',
      plateNumber: `${['CAA', 'CAB', 'CAC', 'CAD'][index % 4]} ${String(4121 + index)}`,
      vehicleModel: VEHICLE_MODELS[index % VEHICLE_MODELS.length],
      vehicleColor: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
      createdAt: manilaDate(1 + (index % 9), 6 + (index % 4), 8 + (index * 3) % 35),
      updatedAt: manilaDate(24 + (index % 5), 7 + (index % 6), 12 + (index * 4) % 35),
      verificationReviewedAt: verifiedAt,
      rejectedReviewAt: rejectedAt,
      rejectedReviewRemarks:
        rejectedAt && index % 2 === 0
          ? 'Please upload a clearer driver license photo before approval.'
          : rejectedAt
            ? 'TODA membership proof needs an updated reference number.'
            : null,
      restrictionReason,
      restrictedAt,
      historicalRestriction:
        base.key === 'driver-09'
          ? {
              restrictedAt: manilaDate(9, 15, 10),
              reinstatedAt: manilaDate(13, 9, 25),
              reason: 'Missed terminal dispatch check-in for two consecutive shifts.',
            }
          : null,
      lastHeartbeatAt,
      onlineSinceAt,
      latitude: isOnline ? roundCoordinate(terminal.latitude + 0.0007 + index * 0.00011) : null,
      longitude: isOnline ? roundCoordinate(terminal.longitude + 0.0005 + index * 0.00009) : null,
    };
  });
}

async function cleanupExistingSeed(params: {
  prisma: PrismaClient;
  staffSpecs: StaffSeedSpec[];
  passengerSpecs: PassengerSeedSpec[];
  driverSpecs: DriverSeedSpec[];
}) {
  const { prisma, staffSpecs, passengerSpecs, driverSpecs } = params;
  const seededUserIds = [...staffSpecs.map((item) => item.id), ...passengerSpecs.map((item) => item.id), ...driverSpecs.map((item) => item.id)];
  const legacyUserIds = [LEGACY_DEV_SEED_IDS.tenantAdmin, LEGACY_DEV_SEED_IDS.driver, LEGACY_DEV_SEED_IDS.passenger];
  const allUserIds = [...seededUserIds, ...legacyUserIds];
  const allDriverIds = [...driverSpecs.map((item) => item.id), LEGACY_DEV_SEED_IDS.driver];
  const allDriverProfileIds = allDriverIds.map((id) => `driver-profile-${id}`);
  const allTerminalIds = [...TERMINAL_SPECS.map((item) => item.id), LEGACY_DEV_SEED_IDS.terminal];
  const seededPhones = [...passengerSpecs.map((item) => item.phone), ...driverSpecs.map((item) => item.phone)];
  const seededEmails = [
    ...staffSpecs.map((item) => item.email),
    ...passengerSpecs.map((item) => item.email).filter((email): email is string => Boolean(email)),
    ...driverSpecs.map((item) => item.email),
  ];
  const rideIds = [
    ...HISTORICAL_RIDE_SLOTS.map((slot) => rideRecordId(slot.id)),
    ...ACTIVE_RIDE_SPECS.map((spec) => rideRecordId(spec.id)),
  ];
  const reservationIds = RESERVATION_BASE_SPECS.map((spec) => reservationRecordId(spec.id));
  const driverDocumentIds = driverSpecs.flatMap((spec) => [
    driverDocumentRecordId(spec.key, 'license'),
    driverDocumentRecordId(spec.key, 'membership'),
    driverDocumentRecordId(spec.key, 'vehicle'),
  ]);
  const driverReviewIds = driverSpecs.flatMap((spec) => [
    driverReviewRecordId(spec.key, 'approved'),
    driverReviewRecordId(spec.key, 'rejected'),
  ]);
  const driverRestrictionIds = driverSpecs.flatMap((spec) => [
    driverRestrictionRecordId(spec.key, 'historical'),
    driverRestrictionRecordId(spec.key, 'reinstated'),
    driverRestrictionRecordId(spec.key, 'current'),
  ]);
  const auditLogIds = Array.from({ length: 8 }, (_, index) => tenantAuditRecordId(index + 1));
  const supportLogIds = Array.from({ length: 3 }, (_, index) => supportAccessRecordId(index + 1));

  await prisma.$transaction(async (tx) => {
    await tx.supportAccessLog.deleteMany({
      where: {
        OR: [{ id: { in: supportLogIds } }, { id: { startsWith: TUGUE_SEED_NAMESPACE } }],
      },
    });
    await tx.tenantAuditLog.deleteMany({
      where: {
        OR: [{ id: { in: auditLogIds } }, { id: { startsWith: TUGUE_SEED_NAMESPACE } }],
      },
    });
    await tx.reservation.deleteMany({
      where: {
        OR: [
          { id: { in: reservationIds } },
          { id: { startsWith: TUGUE_SEED_NAMESPACE } },
          { passengerId: { in: allUserIds } },
          { terminalId: { in: allTerminalIds } },
        ],
      },
    });
    await tx.ride.deleteMany({
      where: {
        OR: [
          { id: { in: rideIds } },
          { id: { startsWith: TUGUE_SEED_NAMESPACE } },
          { passengerId: { in: allUserIds } },
          { driverId: { in: allDriverIds } },
          { terminalId: { in: allTerminalIds } },
        ],
      },
    });
    await tx.driverPresence.deleteMany({ where: { driverId: { in: allDriverIds } } });
    await tx.driverRestrictionLog.deleteMany({
      where: {
        OR: [
          { id: { in: driverRestrictionIds } },
          { id: { startsWith: TUGUE_SEED_NAMESPACE } },
          { driverProfileId: { in: allDriverProfileIds } },
        ],
      },
    });
    await tx.driverVerificationReview.deleteMany({
      where: {
        OR: [
          { id: { in: driverReviewIds } },
          { id: { startsWith: TUGUE_SEED_NAMESPACE } },
          { driverProfileId: { in: allDriverProfileIds } },
        ],
      },
    });
    await tx.driverDocument.deleteMany({
      where: {
        OR: [
          { id: { in: driverDocumentIds } },
          { id: { startsWith: TUGUE_SEED_NAMESPACE } },
          { driverProfileId: { in: allDriverProfileIds } },
        ],
      },
    });
    await tx.tenantMembership.deleteMany({
      where: {
        userId: { in: [...staffSpecs.map((item) => item.id), LEGACY_DEV_SEED_IDS.tenantAdmin] },
      },
    });
    await tx.driverProfile.deleteMany({ where: { userId: { in: allDriverIds } } });
    await tx.tODATerminal.deleteMany({ where: { id: { in: allTerminalIds } } });
    await tx.user.deleteMany({
      where: {
        OR: [
          { id: { in: allUserIds } },
          { id: { startsWith: TUGUE_SEED_NAMESPACE } },
          { phone: { in: seededPhones } },
          { email: { in: seededEmails } },
        ],
      },
    });
  });
}

async function seedTerminals(prisma: PrismaClient, tenantId: string) {
  await prisma.tODATerminal.createMany({
    data: TERMINAL_SPECS.map((terminal) => ({
      id: terminal.id,
      name: terminal.name,
      location: terminal.location,
      tenantId,
      latitude: terminal.latitude,
      longitude: terminal.longitude,
      capacity: terminal.capacity,
      currentQueued: 0,
      createdAt: terminal.createdAt,
      updatedAt: terminal.updatedAt,
    })),
  });

  return Object.fromEntries(TERMINAL_SPECS.map((terminal) => [terminal.key, terminal])) as Record<string, TerminalSeedSpec>;
}

async function seedTenantStaff(
  prisma: PrismaClient,
  tenantId: string,
  staffAuthRecords: Array<{ spec: StaffSeedSpec; auth: { id: string; email: string } }>
) {
  const roleMap = await loadTenantRoleIds(prisma);

  await prisma.user.createMany({
    data: staffAuthRecords.map(({ spec, auth }) => ({
      id: spec.id,
      supabaseId: auth.id,
      name: spec.name,
      email: spec.email,
      role: 'admin',
      tenantId,
      mustResetPassword: false,
      termsAcceptedAt: spec.createdAt,
      createdAt: spec.createdAt,
      updatedAt: spec.updatedAt,
    })),
  });

  const ownerId = staffAuthRecords.find((item) => item.spec.roleKey === 'tenant_owner')?.spec.id ?? null;

  await prisma.tenantMembership.createMany({
    data: staffAuthRecords.map(({ spec }) => ({
      id: tenantMembershipRecordId(spec.id, tenantId),
      userId: spec.id,
      tenantId,
      tenantRoleId: roleMap[spec.roleKey],
      isActive: spec.isActive,
      invitedByUserId: spec.roleKey === 'tenant_owner' ? null : ownerId,
      deactivatedAt: spec.deactivatedAt,
      createdAt: spec.createdAt,
      updatedAt: spec.updatedAt,
    })),
  });

  return {
    owner: findStaffRecord(staffAuthRecords, 'tenant_owner'),
    admin: findStaffRecord(staffAuthRecords, 'tenant_admin'),
    dispatcher: findStaffRecord(staffAuthRecords, 'dispatcher'),
    reportsViewer: findStaffRecord(staffAuthRecords, 'reports_viewer'),
  };
}

async function seedPassengers(prisma: PrismaClient, tenantId: string, passengerSpecs: PassengerSeedSpec[]) {
  await prisma.user.createMany({
    data: passengerSpecs.map((spec) => ({
      id: spec.id,
      name: spec.name,
      email: spec.email,
      phone: spec.phone,
      phoneE164: spec.phone,
      emergencyContactName: spec.emergencyContactName,
      emergencyContactPhone: spec.emergencyContactPhone,
      role: 'passenger',
      tenantId,
      rating: spec.rating,
      balance: spec.balance,
      completedRides: 0,
      mustResetPassword: false,
      termsAcceptedAt: spec.createdAt,
      createdAt: spec.createdAt,
      updatedAt: spec.updatedAt,
    })),
  });

  return Object.fromEntries(passengerSpecs.map((spec) => [spec.id, spec])) as Record<string, PassengerSeedSpec>;
}

async function seedDrivers(
  prisma: PrismaClient,
  tenantId: string,
  driverSpecs: DriverSeedSpec[],
  terminalMap: Record<string, TerminalSeedSpec>,
  reviewedByUserId: string
) {
  await prisma.user.createMany({
    data: driverSpecs.map((spec) => ({
      id: spec.id,
      name: spec.name,
      email: spec.email,
      phone: spec.phone,
      phoneE164: spec.phone,
      role: 'driver',
      tenantId,
      rating: spec.rating,
      completedRides: 0,
      balance: 0,
      isDriverVerified: spec.state !== 'pending',
      isDriverRestricted: spec.state === 'restricted',
      driverRestrictionReason: spec.restrictionReason,
      driverRestrictedAt: spec.restrictedAt,
      mustResetPassword: false,
      termsAcceptedAt: spec.createdAt,
      createdAt: spec.createdAt,
      updatedAt: spec.updatedAt,
      bankAccount: `GCash ${spec.phone.slice(-4)}`,
    })),
  });

  const profiles = new Map<string, string>();

  for (const spec of driverSpecs) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: spec.id },
      select: {
        id: true,
        role: true,
        tenantId: true,
        email: true,
        phone: true,
        phoneE164: true,
        name: true,
        isDriverVerified: true,
        isDriverRestricted: true,
        driverRestrictionReason: true,
        driverRestrictedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const profile = await ensureDriverProfileForUser(prisma, user, {
      legalFullName: spec.name,
      email: spec.email,
      phone: spec.phone,
      homeAddress: spec.homeAddress,
      todaMembershipId: spec.todaMembershipId,
      licenseNumber: spec.licenseNumber,
      licenseExpiry: spec.licenseExpiry,
      vehicleType: spec.vehicleType,
      plateNumber: spec.plateNumber,
      vehicleModel: spec.vehicleModel,
      vehicleColor: spec.vehicleColor,
    });

    assert(profile, `Expected driver profile for ${spec.id}`);
    profiles.set(spec.key, profile.id);

    const verificationStatus = spec.state === 'pending' ? 'pending' : 'verified';
    const restrictionStatus = spec.state === 'restricted' ? 'restricted' : 'unrestricted';

    await prisma.driverProfile.update({
      where: { id: profile.id },
      data: {
        tenantId,
        todaId: terminalMap[spec.terminalKey].id,
        operationalState: resolveDriverOperationalState({
          verificationStatus,
          restrictionStatus,
          isOnline: spec.state === 'verified-online',
        }),
        verificationStatus,
        restrictionStatus,
        contactEmail: spec.email,
        contactPhone: spec.phone,
        legalFullName: spec.name,
        homeAddress: spec.homeAddress,
        todaMembershipId: spec.todaMembershipId,
        licenseNumber: spec.licenseNumber,
        licenseExpiry: spec.licenseExpiry,
        vehicleType: spec.vehicleType,
        plateNumber: spec.plateNumber,
        vehicleModel: spec.vehicleModel,
        vehicleColor: spec.vehicleColor,
        verificationApprovedAt: spec.verificationReviewedAt,
        lastVerificationReviewAt: spec.verificationReviewedAt ?? spec.rejectedReviewAt,
        restrictedAt: spec.restrictedAt,
        currentRestrictionReason: spec.restrictionReason,
        createdAt: spec.createdAt,
        updatedAt: spec.updatedAt,
      },
    });
  }

  const documentRecords = buildDriverDocumentRecords(driverSpecs, profiles, reviewedByUserId);
  const reviewRecords = buildDriverReviewRecords(driverSpecs, profiles, reviewedByUserId);
  const restrictionLogRecords = buildDriverRestrictionLogRecords(driverSpecs, profiles, reviewedByUserId);

  await prisma.driverDocument.createMany({ data: documentRecords });
  await prisma.driverVerificationReview.createMany({ data: reviewRecords });
  await prisma.driverRestrictionLog.createMany({ data: restrictionLogRecords });
  await prisma.driverPresence.createMany({
    data: driverSpecs.map((spec, index) => ({
      driverId: spec.id,
      tenantId,
      isOnline: spec.state === 'verified-online',
      latitude: spec.latitude,
      longitude: spec.longitude,
      heading: spec.state === 'verified-online' ? 60 + index * 12 : null,
      accuracy: spec.state === 'verified-online' ? 8 : null,
      onlineSinceAt: spec.onlineSinceAt,
      lastHeartbeatAt: spec.lastHeartbeatAt,
      createdAt: spec.createdAt,
      updatedAt: spec.lastHeartbeatAt,
    })),
    skipDuplicates: true,
  });

  return {
    byId: Object.fromEntries(driverSpecs.map((spec) => [spec.id, spec])) as Record<string, DriverSeedSpec>,
    byKey: Object.fromEntries(driverSpecs.map((spec) => [spec.key, spec])) as Record<string, DriverSeedSpec>,
    profileIds: profiles,
    documentCount: documentRecords.length,
    reviewCount: reviewRecords.length,
    restrictionLogCount: restrictionLogRecords.length,
  };
}

function buildDriverDocumentRecords(
  driverSpecs: DriverSeedSpec[],
  profileIds: Map<string, string>,
  reviewedByUserId: string
): DriverDocumentSeedRecord[] {
  const records: DriverDocumentSeedRecord[] = [];

  for (const spec of driverSpecs) {
    const profileId = profileIds.get(spec.key);
    assert(profileId, `Missing profile id for ${spec.key}`);
    const reviewedAt = spec.verificationReviewedAt ?? null;
    const reviewStatus = spec.state === 'pending' ? 'submitted' : 'approved';
    const reviewedBy = reviewStatus === 'approved' ? reviewedByUserId : null;

    records.push({
      id: driverDocumentRecordId(spec.key, 'license'),
      driverProfileId: profileId,
      documentType: 'drivers_license',
      fileUrl: `/driver-documents/${slugify(spec.name)}/drivers-license.jpg`,
      storageRef: `driver-documents/${slugify(spec.name)}/drivers-license.jpg`,
      reviewStatus,
      metadata: {
        licenseNumber: spec.licenseNumber,
        licenseExpiry: spec.licenseExpiry.toISOString(),
      } as Prisma.InputJsonValue,
      submittedAt: addMinutes(spec.createdAt, 25),
      reviewedAt,
      reviewedByUserId: reviewedBy,
      remarks:
        reviewStatus === 'approved'
          ? 'Validated against onboarding records.'
          : 'Awaiting manual review from tenant staff.',
      createdAt: addMinutes(spec.createdAt, 25),
      updatedAt: reviewedAt ?? spec.updatedAt,
    });

    records.push({
      id: driverDocumentRecordId(spec.key, 'membership'),
      driverProfileId: profileId,
      documentType: 'toda_membership',
      fileUrl: `/driver-documents/${slugify(spec.name)}/toda-membership.jpg`,
      storageRef: `driver-documents/${slugify(spec.name)}/toda-membership.jpg`,
      reviewStatus,
      metadata: {
        todaMembershipId: spec.todaMembershipId,
        terminalKey: spec.terminalKey,
      } as Prisma.InputJsonValue,
      submittedAt: addMinutes(spec.createdAt, 40),
      reviewedAt,
      reviewedByUserId: reviewedBy,
      remarks:
        reviewStatus === 'approved'
          ? 'Matched with terminal roster.'
          : 'Pending terminal roster confirmation.',
      createdAt: addMinutes(spec.createdAt, 40),
      updatedAt: reviewedAt ?? spec.updatedAt,
    });

    records.push({
      id: driverDocumentRecordId(spec.key, 'vehicle'),
      driverProfileId: profileId,
      documentType: 'vehicle_registration',
      fileUrl: `/driver-documents/${slugify(spec.name)}/vehicle-registration.jpg`,
      storageRef: `driver-documents/${slugify(spec.name)}/vehicle-registration.jpg`,
      reviewStatus,
      metadata: {
        plateNumber: spec.plateNumber,
        vehicleModel: spec.vehicleModel,
        vehicleColor: spec.vehicleColor,
      } as Prisma.InputJsonValue,
      submittedAt: addMinutes(spec.createdAt, 55),
      reviewedAt,
      reviewedByUserId: reviewedBy,
      remarks:
        reviewStatus === 'approved'
          ? 'Vehicle registration is current for tenant operations.'
          : 'Vehicle OR/CR still awaiting admin validation.',
      createdAt: addMinutes(spec.createdAt, 55),
      updatedAt: reviewedAt ?? spec.updatedAt,
    });
  }

  return records;
}

function buildDriverReviewRecords(
  driverSpecs: DriverSeedSpec[],
  profileIds: Map<string, string>,
  reviewedByUserId: string
): ReviewSeedRecord[] {
  const records: ReviewSeedRecord[] = [];

  for (const spec of driverSpecs) {
    const profileId = profileIds.get(spec.key);
    assert(profileId, `Missing profile id for ${spec.key}`);

    if (spec.verificationReviewedAt) {
      records.push({
        id: driverReviewRecordId(spec.key, 'approved'),
        driverProfileId: profileId,
        decision: 'approved',
        reviewedByUserId,
        remarks: 'Driver cleared for active TODA operations within Tuguegarao City.',
        createdAt: spec.verificationReviewedAt,
      });
    }

    if (spec.rejectedReviewAt) {
      records.push({
        id: driverReviewRecordId(spec.key, 'rejected'),
        driverProfileId: profileId,
        decision: 'rejected',
        reviewedByUserId,
        remarks: spec.rejectedReviewRemarks,
        createdAt: spec.rejectedReviewAt,
      });
    }
  }

  return records;
}

function buildDriverRestrictionLogRecords(
  driverSpecs: DriverSeedSpec[],
  profileIds: Map<string, string>,
  actedByUserId: string
): RestrictionLogSeedRecord[] {
  const records: RestrictionLogSeedRecord[] = [];

  for (const spec of driverSpecs) {
    const profileId = profileIds.get(spec.key);
    assert(profileId, `Missing profile id for ${spec.key}`);

    if (spec.historicalRestriction) {
      records.push({
        id: driverRestrictionRecordId(spec.key, 'historical'),
        driverProfileId: profileId,
        action: 'restricted',
        actedByUserId,
        reason: spec.historicalRestriction.reason,
        createdAt: spec.historicalRestriction.restrictedAt,
      });
      records.push({
        id: driverRestrictionRecordId(spec.key, 'reinstated'),
        driverProfileId: profileId,
        action: 'reinstated',
        actedByUserId,
        reason: 'Returned to active roster after compliance counseling.',
        createdAt: spec.historicalRestriction.reinstatedAt,
      });
    }

    if (spec.state === 'restricted' && spec.restrictedAt && spec.restrictionReason) {
      records.push({
        id: driverRestrictionRecordId(spec.key, 'current'),
        driverProfileId: profileId,
        action: 'restricted',
        actedByUserId,
        reason: spec.restrictionReason,
        createdAt: spec.restrictedAt,
      });
    }
  }

  return records;
}

function buildRideRecords(
  tenantId: string,
  passengerUsers: Record<string, PassengerSeedSpec>,
  seededDrivers: {
    byId: Record<string, DriverSeedSpec>;
    byKey: Record<string, DriverSeedSpec>;
  },
  terminalMap: Record<string, TerminalSeedSpec>,
  rng: () => number
): RideSeedRecord[] {
  const passengers = Object.values(passengerUsers);
  const historicalRecords = HISTORICAL_RIDE_SLOTS.map((slot, index) =>
    buildHistoricalRideRecord(tenantId, slot, index, passengers, seededDrivers.byKey, terminalMap, rng)
  );
  const activeRecords = ACTIVE_RIDE_SPECS.map((spec, index) =>
    buildActiveRideRecord(tenantId, spec, index, passengers, seededDrivers.byKey, terminalMap)
  );

  return [...historicalRecords, ...activeRecords];
}

function buildHistoricalRideRecord(
  tenantId: string,
  slot: RideSlot,
  index: number,
  passengers: PassengerSeedSpec[],
  driverByKey: Record<string, DriverSeedSpec>,
  terminalMap: Record<string, TerminalSeedSpec>,
  rng: () => number
): RideSeedRecord {
  const passenger = passengers[slot.passengerIndex];
  assert(passenger, `Missing passenger for ride slot ${slot.id}`);
  const driver = slot.driverKey ? driverByKey[slot.driverKey] : null;
  const terminal = driver ? terminalMap[driver.terminalKey] : terminalMap[findNearestTerminalKeyForPattern(slot.pattern, index, terminalMap)];
  const route = selectRidePlaces(slot.pattern, index, terminal);
  const distance = estimateRideDistanceKm(route.pickup, route.dropoff, rng);
  const estimatedDuration = estimateRideDurationMinutes(distance, slot.pattern);

  if (slot.status === 'completed') {
    const startedAt = addMinutes(slot.createdAt, 4 + (index % 5));
    const actualDuration = Math.max(7, estimatedDuration - 2 + (index % 6));
    const completedAt = addMinutes(startedAt, actualDuration);

    return {
      id: rideRecordId(slot.id),
      tenantId,
      passengerId: passenger.id,
      driverId: driver?.id ?? null,
      terminalId: terminal.id,
      pickupLocation: route.pickup.label,
      dropoffLocation: route.dropoff.label,
      pickupLatitude: route.pickup.latitude,
      pickupLongitude: route.pickup.longitude,
      dropoffLatitude: route.dropoff.latitude,
      dropoffLongitude: route.dropoff.longitude,
      status: 'completed',
      fare: computeRideFare(distance, actualDuration),
      distance,
      estimatedDuration,
      actualDuration,
      rideType: 'on-demand',
      driverLatitude: null,
      driverLongitude: null,
      createdAt: slot.createdAt,
      startedAt,
      completedAt,
      updatedAt: completedAt,
    };
  }

  return {
    id: rideRecordId(slot.id),
    tenantId,
    passengerId: passenger.id,
    driverId: driver?.id ?? null,
    terminalId: terminal.id,
    pickupLocation: route.pickup.label,
    dropoffLocation: route.dropoff.label,
    pickupLatitude: route.pickup.latitude,
    pickupLongitude: route.pickup.longitude,
    dropoffLatitude: route.dropoff.latitude,
    dropoffLongitude: route.dropoff.longitude,
    status: 'cancelled',
    fare: computeRideFare(distance, estimatedDuration),
    distance,
    estimatedDuration,
    actualDuration: null,
    rideType: 'on-demand',
    driverLatitude: null,
    driverLongitude: null,
    createdAt: slot.createdAt,
    startedAt: null,
    completedAt: null,
    updatedAt: addMinutes(slot.createdAt, driver ? 6 + (index % 4) : 3 + (index % 5)),
  };
}

function buildActiveRideRecord(
  tenantId: string,
  spec: (typeof ACTIVE_RIDE_SPECS)[number],
  index: number,
  passengers: PassengerSeedSpec[],
  driverByKey: Record<string, DriverSeedSpec>,
  terminalMap: Record<string, TerminalSeedSpec>
): RideSeedRecord {
  const passenger = passengers[spec.passengerIndex];
  assert(passenger, `Missing passenger for active ride ${spec.id}`);
  const driver = spec.driverKey ? driverByKey[spec.driverKey] : null;
  const terminal = terminalMap[spec.terminalKey];
  assert(terminal, `Missing terminal ${spec.terminalKey}`);
  const route = selectRidePlaces(spec.pattern, HISTORICAL_RIDE_SLOTS.length + index, terminal);
  const distance = estimateRideDistanceKm(route.pickup, route.dropoff, () => 0.42);
  const estimatedDuration = estimateRideDurationMinutes(distance, spec.pattern);
  const driverPosition = resolveActiveDriverPosition(spec.status, terminal, route.pickup, route.dropoff);

  return {
    id: rideRecordId(spec.id),
    tenantId,
    passengerId: passenger.id,
    driverId: driver?.id ?? null,
    terminalId: terminal.id,
    pickupLocation: route.pickup.label,
    dropoffLocation: route.dropoff.label,
    pickupLatitude: route.pickup.latitude,
    pickupLongitude: route.pickup.longitude,
    dropoffLatitude: route.dropoff.latitude,
    dropoffLongitude: route.dropoff.longitude,
    status: spec.status,
    fare: computeRideFare(distance, estimatedDuration),
    distance,
    estimatedDuration,
    actualDuration: null,
    rideType: 'on-demand',
    driverLatitude: driverPosition.latitude,
    driverLongitude: driverPosition.longitude,
    createdAt: spec.createdAt,
    startedAt: spec.status === 'in_trip' ? addMinutes(spec.createdAt, 7) : null,
    completedAt: null,
    updatedAt: spec.status === 'searching' ? spec.createdAt : addMinutes(spec.createdAt, 3 + index),
  };
}

function buildReservationRecords(
  tenantId: string,
  passengerUsers: Record<string, PassengerSeedSpec>,
  terminalMap: Record<string, TerminalSeedSpec>
): ReservationSeedRecord[] {
  const passengers = Object.values(passengerUsers);

  return RESERVATION_BASE_SPECS.map((spec) => {
    const passenger = passengers[spec.passengerIndex];
    const terminal = terminalMap[spec.terminalKey];
    assert(passenger, `Missing passenger for reservation ${spec.id}`);
    assert(terminal, `Missing terminal for reservation ${spec.id}`);

    return {
      id: reservationRecordId(spec.id),
      tenantId,
      passengerId: passenger.id,
      terminalId: terminal.id,
      boardingTime: spec.boardingTime,
      status: spec.status,
      queuePosition: spec.queuePosition,
      createdAt: spec.createdAt,
      updatedAt: spec.updatedAt,
    };
  });
}

function buildTenantAuditLogs(
  tenantId: string,
  staffUsers: {
    owner: { id: string };
    admin: { id: string };
    dispatcher: { id: string };
    reportsViewer: { id: string };
  },
  seededDrivers: {
    byKey: Record<string, DriverSeedSpec>;
    profileIds: Map<string, string>;
  },
  terminalMap: Record<string, TerminalSeedSpec>
): AuditLogSeedRecord[] {
  return [
    {
      id: tenantAuditRecordId(1),
      tenantId,
      actorUserId: staffUsers.owner.id,
      module: 'tenant.team',
      action: 'membership.created',
      targetType: 'TenantMembership',
      targetId: tenantMembershipRecordId(staffUsers.admin.id, tenantId),
      beforeJson: Prisma.JsonNull,
      afterJson: { role: 'tenant_admin', invitedBy: staffUsers.owner.id } as Prisma.InputJsonValue,
      createdAt: manilaDate(1, 8, 25),
    },
    {
      id: tenantAuditRecordId(2),
      tenantId,
      actorUserId: staffUsers.admin.id,
      module: 'drivers.verification',
      action: 'driver.approved',
      targetType: 'DriverProfile',
      targetId: seededDrivers.profileIds.get('driver-01') ?? null,
      beforeJson: { verificationStatus: 'pending' } as Prisma.InputJsonValue,
      afterJson: { verificationStatus: 'verified', operationalState: 'offline' } as Prisma.InputJsonValue,
      createdAt: manilaDate(6, 10, 15),
    },
    {
      id: tenantAuditRecordId(3),
      tenantId,
      actorUserId: staffUsers.admin.id,
      module: 'drivers.restrictions',
      action: 'driver.restricted',
      targetType: 'DriverProfile',
      targetId: seededDrivers.profileIds.get('driver-15') ?? null,
      beforeJson: { restrictionStatus: 'unrestricted' } as Prisma.InputJsonValue,
      afterJson: { restrictionStatus: 'restricted', reason: seededDrivers.byKey['driver-15']?.restrictionReason } as Prisma.InputJsonValue,
      createdAt: manilaDate(24, 16, 25),
    },
    {
      id: tenantAuditRecordId(4),
      tenantId,
      actorUserId: staffUsers.dispatcher.id,
      module: 'reservations.queue',
      action: 'reservation.cancelled',
      targetType: 'Reservation',
      targetId: reservationRecordId(`${TUGUE_SEED_NAMESPACE}-reservation-009`),
      beforeJson: { status: 'confirmed', queuePosition: 1 } as Prisma.InputJsonValue,
      afterJson: { status: 'cancelled' } as Prisma.InputJsonValue,
      createdAt: manilaDate(20, 7, 2),
    },
    {
      id: tenantAuditRecordId(5),
      tenantId,
      actorUserId: staffUsers.admin.id,
      module: 'terminals.capacity',
      action: 'terminal.updated',
      targetType: 'TODATerminal',
      targetId: terminalMap.centro.id,
      beforeJson: { capacity: 24 } as Prisma.InputJsonValue,
      afterJson: { capacity: terminalMap.centro.capacity } as Prisma.InputJsonValue,
      createdAt: manilaDate(21, 13, 30),
    },
    {
      id: tenantAuditRecordId(6),
      tenantId,
      actorUserId: staffUsers.owner.id,
      module: 'tenant.settings',
      action: 'branding.updated',
      targetType: 'TenantSettings',
      targetId: tenantSettingsRecordId(tenantId),
      beforeJson: { primaryColor: '#0f172a' } as Prisma.InputJsonValue,
      afterJson: { primaryColor: '#0f766e', accentColor: '#f59e0b' } as Prisma.InputJsonValue,
      createdAt: manilaDate(22, 15, 5),
    },
    {
      id: tenantAuditRecordId(7),
      tenantId,
      actorUserId: staffUsers.dispatcher.id,
      module: 'rides.dispatch',
      action: 'ride.cancelled',
      targetType: 'Ride',
      targetId: rideRecordId(`${TUGUE_SEED_NAMESPACE}-ride-034`),
      beforeJson: { status: 'searching' } as Prisma.InputJsonValue,
      afterJson: { status: 'cancelled' } as Prisma.InputJsonValue,
      createdAt: manilaDate(29, 7, 3),
    },
    {
      id: tenantAuditRecordId(8),
      tenantId,
      actorUserId: staffUsers.owner.id,
      module: 'tenant.team',
      action: 'membership.deactivated',
      targetType: 'TenantMembership',
      targetId: tenantMembershipRecordId(staffUsers.reportsViewer.id, tenantId),
      beforeJson: { isActive: true } as Prisma.InputJsonValue,
      afterJson: { isActive: false, deactivatedAt: manilaDate(27, 16, 20).toISOString() } as Prisma.InputJsonValue,
      createdAt: manilaDate(27, 16, 20),
    },
  ];
}

function buildSupportAccessLogs(tenantId: string, superadminUserId: string): SupportAccessSeedRecord[] {
  return [
    {
      id: supportAccessRecordId(1),
      tenantId,
      superAdminUserId: superadminUserId,
      accessType: 'dashboard_readonly',
      reason: 'Reviewed terminal occupancy spike reported by Tuguegarao dispatcher.',
      createdAt: manilaDate(18, 18, 10),
    },
    {
      id: supportAccessRecordId(2),
      tenantId,
      superAdminUserId: superadminUserId,
      accessType: 'report_investigation',
      reason: 'Checked ride completion totals before monthly tenant reporting export.',
      createdAt: manilaDate(24, 9, 35),
    },
    {
      id: supportAccessRecordId(3),
      tenantId,
      superAdminUserId: superadminUserId,
      accessType: 'driver_review_assist',
      reason: 'Assisted tenant admin with a pending driver verification question.',
      createdAt: manilaDate(29, 11, 50),
    },
  ];
}

async function reconcileRideCounters(
  prisma: PrismaClient,
  passengerSpecs: PassengerSeedSpec[],
  driverSpecs: DriverSeedSpec[],
  rides: RideSeedRecord[]
) {
  const completedRideCounts = new Map<string, number>();
  const latestActivity = new Map<string, Date>();

  for (const ride of rides) {
    const activityAt = toDate(ride.completedAt ?? ride.updatedAt ?? ride.createdAt ?? TUGUE_FEB_START);
    latestActivity.set(ride.passengerId, maxDate(latestActivity.get(ride.passengerId), activityAt));

    if (ride.driverId) {
      latestActivity.set(ride.driverId, maxDate(latestActivity.get(ride.driverId), activityAt));
    }

    if (ride.status === 'completed') {
      completedRideCounts.set(ride.passengerId, (completedRideCounts.get(ride.passengerId) ?? 0) + 1);
      if (ride.driverId) {
        completedRideCounts.set(ride.driverId, (completedRideCounts.get(ride.driverId) ?? 0) + 1);
      }
    }
  }

  for (const passenger of passengerSpecs) {
    await prisma.user.update({
      where: { id: passenger.id },
      data: {
        completedRides: completedRideCounts.get(passenger.id) ?? 0,
        updatedAt: latestActivity.get(passenger.id) ?? passenger.updatedAt,
      },
    });
  }

  for (const driver of driverSpecs) {
    await prisma.user.update({
      where: { id: driver.id },
      data: {
        completedRides: completedRideCounts.get(driver.id) ?? 0,
        updatedAt: maxDate(latestActivity.get(driver.id), driver.updatedAt),
      },
    });
  }
}

async function recomputeTerminalQueues(prisma: PrismaClient, terminalMap: Record<string, TerminalSeedSpec>) {
  for (const terminal of Object.values(terminalMap)) {
    const activeQueueCount = await prisma.reservation.count({
      where: {
        terminalId: terminal.id,
        status: { in: ['confirmed', 'arrived'] },
      },
    });

    await prisma.tODATerminal.update({
      where: { id: terminal.id },
      data: {
        currentQueued: activeQueueCount,
        updatedAt: manilaDate(29, 18, 30),
      },
    });
  }
}

async function verifySeed(
  prisma: PrismaClient,
  params: {
    passengerSpecs: PassengerSeedSpec[];
    driverSpecs: DriverSeedSpec[];
    rideIds: string[];
    reservationIds: string[];
    auditLogIds: string[];
    supportLogIds: string[];
    counts: Record<string, number>;
  }
) {
  const { passengerSpecs, driverSpecs, rideIds, reservationIds, auditLogIds, supportLogIds, counts } = params;
  const userIds = [...passengerSpecs.map((item) => item.id), ...driverSpecs.map((item) => item.id)];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      phone: true,
      completedRides: true,
      updatedAt: true,
      isDriverVerified: true,
      isDriverRestricted: true,
    },
  });

  assert.equal(users.length, passengerSpecs.length + driverSpecs.length, 'Expected seeded passenger and driver users.');
  const phoneValues = users.map((user) => user.phone).filter((phone): phone is string => Boolean(phone));
  assert.equal(new Set(phoneValues).size, phoneValues.length, 'Seeded phones must be unique.');
  const emailValues = users.map((user) => user.email).filter((email): email is string => Boolean(email));
  assert.equal(new Set(emailValues).size, emailValues.length, 'Seeded emails must be unique where present.');

  const rides = await prisma.ride.findMany({
    where: { id: { in: rideIds } },
    select: {
      id: true,
      passengerId: true,
      driverId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      completedAt: true,
      actualDuration: true,
    },
  });

  assert.equal(rides.length, counts.Ride, 'Expected seeded rides count to match.');
  assert.equal(rides.filter((ride) => ride.status === 'completed').length, 26, 'Expected 26 completed rides.');
  assert.equal(rides.filter((ride) => ride.status === 'cancelled').length, 8, 'Expected 8 cancelled rides.');
  assert.equal(rides.filter((ride) => ride.status === 'searching').length, 2, 'Expected 2 searching rides.');
  assert.equal(rides.filter((ride) => ride.status === 'matched').length, 1, 'Expected 1 matched ride.');
  assert.equal(rides.filter((ride) => ride.status === 'en_route').length, 1, 'Expected 1 en_route ride.');
  assert.equal(rides.filter((ride) => ride.status === 'arrived').length, 1, 'Expected 1 arrived ride.');
  assert.equal(rides.filter((ride) => ride.status === 'in_trip').length, 1, 'Expected 1 in_trip ride.');

  const activePassengerCounts = new Map<string, number>();
  const activeDriverCounts = new Map<string, number>();

  for (const ride of rides) {
    assertDateRange(ride.createdAt, `${ride.id} createdAt`);
    assertDateRange(ride.updatedAt, `${ride.id} updatedAt`);

    if (ride.startedAt) {
      assertDateRange(ride.startedAt, `${ride.id} startedAt`);
      assert.ok(['in_trip', 'completed'].includes(ride.status), `Ride ${ride.id} should only have startedAt for in_trip/completed.`);
    } else {
      assert.notEqual(ride.status, 'completed', `Ride ${ride.id} should have startedAt when completed.`);
    }

    if (ride.completedAt) {
      assertDateRange(ride.completedAt, `${ride.id} completedAt`);
      assert.equal(ride.status, 'completed', `Ride ${ride.id} completedAt requires completed status.`);
      assert.ok(typeof ride.actualDuration === 'number' && ride.actualDuration > 0, `Ride ${ride.id} needs actualDuration.`);
    } else {
      assert.notEqual(ride.status, 'completed', `Ride ${ride.id} missing completedAt for completed status.`);
    }

    if (ACTIVE_PASSENGER_RIDE_STATUS_SET.has(ride.status)) {
      activePassengerCounts.set(ride.passengerId, (activePassengerCounts.get(ride.passengerId) ?? 0) + 1);
    }

    if (ride.driverId && ACTIVE_DRIVER_RIDE_STATUS_SET.has(ride.status)) {
      activeDriverCounts.set(ride.driverId, (activeDriverCounts.get(ride.driverId) ?? 0) + 1);
    }
  }

  for (const count of activePassengerCounts.values()) {
    assert.ok(count <= 1, 'Passenger should not have more than one active ride.');
  }

  for (const count of activeDriverCounts.values()) {
    assert.ok(count <= 1, 'Driver should not have more than one active ride.');
  }

  const driverProfiles = await prisma.driverProfile.findMany({
    where: { userId: { in: driverSpecs.map((item) => item.id) } },
    select: {
      userId: true,
      verificationStatus: true,
      restrictionStatus: true,
      operationalState: true,
      updatedAt: true,
    },
  });

  assert.equal(driverProfiles.length, counts.DriverProfile, 'Expected seeded driver profiles count to match.');
  const driverProfileMap = new Map(driverProfiles.map((profile) => [profile.userId, profile]));

  for (const [driverId] of activeDriverCounts) {
    const profile = driverProfileMap.get(driverId);
    assert(profile, `Missing driver profile for active ride driver ${driverId}`);
    assert.equal(profile.verificationStatus, 'verified', `Active driver ${driverId} must be verified.`);
    assert.equal(profile.restrictionStatus, 'unrestricted', `Active driver ${driverId} must not be restricted.`);
  }

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: reservationIds } },
    orderBy: [{ terminalId: 'asc' }, { queuePosition: 'asc' }],
    select: {
      id: true,
      terminalId: true,
      status: true,
      queuePosition: true,
      createdAt: true,
      updatedAt: true,
      boardingTime: true,
    },
  });

  assert.equal(reservations.length, counts.Reservation, 'Expected seeded reservations count to match.');
  assert.equal(reservations.filter((reservation) => reservation.status === 'completed').length, 7, 'Expected 7 completed reservations.');
  assert.equal(reservations.filter((reservation) => reservation.status === 'cancelled').length, 3, 'Expected 3 cancelled reservations.');
  assert.equal(reservations.filter((reservation) => reservation.status === 'confirmed').length, 3, 'Expected 3 confirmed reservations.');
  assert.equal(reservations.filter((reservation) => reservation.status === 'arrived').length, 1, 'Expected 1 arrived reservation.');

  const reservationsByTerminal = new Map<string, typeof reservations>();

  for (const reservation of reservations) {
    assertDateRange(reservation.createdAt, `${reservation.id} createdAt`);
    assertDateRange(reservation.updatedAt, `${reservation.id} updatedAt`);
    assertDateRange(reservation.boardingTime, `${reservation.id} boardingTime`);
    const bucket = reservationsByTerminal.get(reservation.terminalId) ?? [];
    bucket.push(reservation);
    reservationsByTerminal.set(reservation.terminalId, bucket);
  }

  const terminals = await prisma.tODATerminal.findMany({
    where: { id: { in: TERMINAL_SPECS.map((item) => item.id) } },
    select: { id: true, currentQueued: true, updatedAt: true },
  });

  assert.equal(terminals.length, counts.TODATerminal, 'Expected seeded terminal count to match.');

  for (const terminal of terminals) {
    assertDateRange(terminal.updatedAt, `${terminal.id} updatedAt`);
    const active = (reservationsByTerminal.get(terminal.id) ?? []).filter((reservation) =>
      ACTIVE_RESERVATION_STATUS_SET.has(reservation.status)
    );
    const arrivedCount = active.filter((reservation) => reservation.status === 'arrived').length;
    assert.ok(arrivedCount <= 1, `Terminal ${terminal.id} should have at most one arrived reservation.`);
    active.forEach((reservation, index) => {
      assert.equal(reservation.queuePosition, index + 1, `Active reservation queue must be sequential for terminal ${terminal.id}.`);
    });
    assert.equal(terminal.currentQueued, active.length, `Terminal ${terminal.id} currentQueued must equal active confirmed + arrived reservations.`);
  }

  const presences = await prisma.driverPresence.findMany({
    where: { driverId: { in: driverSpecs.map((item) => item.id) } },
    select: {
      driverId: true,
      isOnline: true,
      createdAt: true,
      updatedAt: true,
      onlineSinceAt: true,
      lastHeartbeatAt: true,
    },
  });

  assert.equal(presences.length, counts.DriverPresence, 'Expected seeded driver presence count to match.');

  for (const presence of presences) {
    assertDateRange(presence.createdAt, `${presence.driverId} presence createdAt`);
    assertDateRange(presence.updatedAt, `${presence.driverId} presence updatedAt`);
    assertDateRange(presence.lastHeartbeatAt, `${presence.driverId} lastHeartbeatAt`);
    if (presence.onlineSinceAt) {
      assertDateRange(presence.onlineSinceAt, `${presence.driverId} onlineSinceAt`);
    }

    const profile = driverProfileMap.get(presence.driverId);
    assert(profile, `Expected profile for presence ${presence.driverId}`);

    if (presence.isOnline) {
      assert.equal(profile.operationalState, 'online', `Online driver ${presence.driverId} must be operationally online.`);
      assert.equal(profile.verificationStatus, 'verified', `Online driver ${presence.driverId} must be verified.`);
      assert.equal(profile.restrictionStatus, 'unrestricted', `Online driver ${presence.driverId} must be unrestricted.`);
    }
  }

  const auditLogs = await prisma.tenantAuditLog.findMany({
    where: { id: { in: auditLogIds } },
    select: { id: true, createdAt: true },
  });
  assert.equal(auditLogs.length, counts.TenantAuditLog, 'Expected seeded audit log count to match.');
  auditLogs.forEach((log) => assertDateRange(log.createdAt, `${log.id} createdAt`));

  const supportLogs = await prisma.supportAccessLog.findMany({
    where: { id: { in: supportLogIds } },
    select: { id: true, createdAt: true },
  });
  assert.equal(supportLogs.length, counts.SupportAccessLog, 'Expected seeded support access log count to match.');
  supportLogs.forEach((log) => assertDateRange(log.createdAt, `${log.id} createdAt`));
}

async function loadTenantRoleIds(prisma: PrismaClient) {
  const roles = await prisma.tenantRole.findMany({
    where: {
      key: {
        in: ['tenant_owner', 'tenant_admin', 'dispatcher', 'reports_viewer'],
      },
    },
    select: {
      id: true,
      key: true,
    },
  });

  assert.equal(roles.length, 4, 'Expected system tenant roles to be seeded before staff memberships.');
  return Object.fromEntries(roles.map((role) => [role.key, role.id])) as Record<StaffRoleKey, string>;
}

function findStaffRecord(
  staffAuthRecords: Array<{ spec: StaffSeedSpec; auth: { id: string; email: string } }>,
  roleKey: StaffRoleKey
) {
  const record = staffAuthRecords.find((item) => item.spec.roleKey === roleKey);
  assert(record, `Missing seeded staff account for role ${roleKey}`);
  return {
    id: record.spec.id,
    email: record.spec.email,
  };
}

function selectRidePlaces(pattern: RidePatternKey, index: number, terminal: TerminalSeedSpec) {
  const pairIds = RIDE_PATTERN_PAIR_IDS[pattern];
  const rankedPairs = [...pairIds]
    .map(([pickupId, dropoffId]) => {
      const pickup = getPlaceById(pickupId);
      const dropoff = getPlaceById(dropoffId);
      const score = haversineKm(
        { latitude: pickup.latitude, longitude: pickup.longitude },
        { latitude: terminal.latitude, longitude: terminal.longitude }
      );

      return {
        pickup,
        dropoff,
        score,
      };
    })
    .sort((left, right) => left.score - right.score);

  return rankedPairs[index % rankedPairs.length] ?? rankedPairs[0];
}

function resolveActiveDriverPosition(
  status: 'searching' | 'matched' | 'en_route' | 'arrived' | 'in_trip',
  terminal: TerminalSeedSpec,
  pickup: Place,
  dropoff: Place
) {
  if (status === 'searching') {
    return { latitude: null, longitude: null };
  }

  if (status === 'matched') {
    return {
      latitude: roundCoordinate((terminal.latitude + pickup.latitude) / 2),
      longitude: roundCoordinate((terminal.longitude + pickup.longitude) / 2),
    };
  }

  if (status === 'en_route') {
    return {
      latitude: roundCoordinate((pickup.latitude * 0.7) + (terminal.latitude * 0.3)),
      longitude: roundCoordinate((pickup.longitude * 0.7) + (terminal.longitude * 0.3)),
    };
  }

  if (status === 'arrived') {
    return {
      latitude: pickup.latitude,
      longitude: pickup.longitude,
    };
  }

  return {
    latitude: roundCoordinate((pickup.latitude + dropoff.latitude) / 2),
    longitude: roundCoordinate((pickup.longitude + dropoff.longitude) / 2),
  };
}

function estimateRideDistanceKm(pickup: Place, dropoff: Place, rng: () => number) {
  const straightLine = haversineKm(
    { latitude: pickup.latitude, longitude: pickup.longitude },
    { latitude: dropoff.latitude, longitude: dropoff.longitude }
  );

  return roundDistance(Math.max(1.1, straightLine * 1.18 + 0.45 + rng() * 0.25));
}

function estimateRideDurationMinutes(distanceKm: number, pattern: RidePatternKey) {
  const multiplier =
    pattern === 'morning-commute'
      ? 1.28
      : pattern === 'lunch-movement'
        ? 1.1
        : pattern === 'afternoon-rush'
          ? 1.2
          : pattern === 'evening-return'
            ? 1.34
            : 1.05;

  return Math.max(8, Math.round(distanceKm * 4.4 * multiplier + 3));
}

function computeRideFare(distanceKm: number, durationMinutes: number) {
  return roundMoney(
    BOOKING_FARE.BASE_FARE + distanceKm * BOOKING_FARE.PER_KM + durationMinutes * BOOKING_FARE.PER_MINUTE
  );
}

function getPlaceById(id: string) {
  const place = TUGUE_PLACES.find((item) => item.id === id);
  assert(place, `Unknown place id: ${id}`);
  return place;
}

function findNearestTerminalKeyForPattern(
  pattern: RidePatternKey,
  index: number,
  terminalMap: Record<string, TerminalSeedSpec>
) {
  const pair = selectRidePlaces(pattern, index, TERMINAL_SPECS[index % TERMINAL_SPECS.length] ?? TERMINAL_SPECS[0]);
  let winner = TERMINAL_SPECS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const terminal of Object.values(terminalMap)) {
    const distance = haversineKm(
      { latitude: pair.pickup.latitude, longitude: pair.pickup.longitude },
      { latitude: terminal.latitude, longitude: terminal.longitude }
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      winner = terminal;
    }
  }

  return winner.key;
}

function buildPhilippineMobile(kind: 'passenger' | 'driver' | 'emergency', index: number) {
  const prefixes =
    kind === 'passenger'
      ? ['917', '918', '919', '920', '921', '922', '923', '925']
      : kind === 'driver'
        ? ['945', '946', '947', '948', '949', '961', '962', '963']
        : ['965', '966', '967', '968', '969', '981', '982', '983'];

  const prefix = prefixes[index % prefixes.length] ?? '917';
  const subscriberBase = kind === 'passenger' ? 4100000 : kind === 'driver' ? 5200000 : 6300000;
  return `+63${prefix}${String(subscriberBase + index).padStart(7, '0')}`;
}

function resolvePublicSeedEmailDomain(domain: string) {
  const normalized = domain.trim().toLowerCase();
  if (!normalized || normalized.endsWith('.local') || normalized.endsWith('.test') || normalized.endsWith('.example')) {
    return 'gmail.com';
  }

  return normalized;
}

function buildPersonalEmail(name: string, index: number, kind: 'passenger' | 'driver') {
  const domains =
    kind === 'driver'
      ? ['gmail.com', 'yahoo.com', 'outlook.com']
      : ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const localBase = slugify(name);
  const suffix = String((kind === 'driver' ? 70 : 18) + index).padStart(2, '0');
  return `${localBase}${suffix}@${domains[index % domains.length] ?? 'gmail.com'}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function manilaDate(day: number, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(2024, 1, day, hour - 8, minute, second, 0));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let output = state;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function stableOpaqueId(scope: string, key: string) {
  const hash = createHash('sha256')
    .update(`${TUGUE_SEED_NAMESPACE}:${scope}:${key}`)
    .digest('hex');

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function tenantMembershipRecordId(userId: string, tenantId: string) {
  return stableOpaqueId('tenant-membership', `${tenantId}:${userId}`);
}

function rideRecordId(key: string) {
  return stableOpaqueId('ride', key);
}

function reservationRecordId(key: string) {
  return stableOpaqueId('reservation', key);
}

function driverDocumentRecordId(
  driverKey: string,
  documentKey: 'license' | 'membership' | 'vehicle'
) {
  return stableOpaqueId('driver-document', `${driverKey}:${documentKey}`);
}

function driverReviewRecordId(driverKey: string, reviewKey: 'approved' | 'rejected') {
  return stableOpaqueId('driver-review', `${driverKey}:${reviewKey}`);
}

function driverRestrictionRecordId(
  driverKey: string,
  restrictionKey: 'historical' | 'reinstated' | 'current'
) {
  return stableOpaqueId('driver-restriction', `${driverKey}:${restrictionKey}`);
}

function tenantAuditRecordId(index: number) {
  return stableOpaqueId('tenant-audit', String(index).padStart(3, '0'));
}

function supportAccessRecordId(index: number) {
  return stableOpaqueId('support-access', String(index).padStart(3, '0'));
}

function tenantSettingsRecordId(tenantId: string) {
  return stableOpaqueId('tenant-settings', tenantId);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}

function roundDistance(value: number) {
  return Math.round(value * 100) / 100;
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function haversineKm(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(right.latitude - left.latitude);
  const deltaLon = toRad(right.longitude - left.longitude);
  const startLat = toRad(left.latitude);
  const endLat = toRad(right.latitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maxDate(current: Date | undefined, candidate: Date) {
  if (!current) return candidate;
  return current.getTime() >= candidate.getTime() ? current : candidate;
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function assertDateRange(date: Date, label: string) {
  assert.ok(
    date.getTime() >= TUGUE_FEB_START.getTime() && date.getTime() <= TUGUE_FEB_END.getTime(),
    `${label} must stay within February 2024.`
  );
}
