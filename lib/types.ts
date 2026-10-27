export type User = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  businessName: string | null;
  phone: string | null;
  supportEmail: string | null;
  currency: string;
  timezone: string;
  notifyPaymentSuccess: boolean;
  notifySessionExpired: boolean;
  notifySystem: boolean;
  /** Holiday / promo free Wi‑Fi for all owner hotspots. */
  freeModeEnabled: boolean;
  freeModeStartsAt: string | null;
  freeModeEndsAt: string | null;
  freeModePackageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Package = {
  id: string;
  ownerId: string;
  name: string;
  price: number;
  durationMinutes: number;
  dataLimitMb: number | null;
  speedProfile: string;
  currency: string;
  enabled: boolean;
  /** null / empty = available at all owner hotspots */
  hotspotIds: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type HotspotStatus = "active" | "inactive" | "maintenance";

export type RouterAdapterType =
  | "mock"
  | "mikrotik"
  | "unifi"
  | "pfsense"
  | "openwrt"
  | "starlink"
  | "generic";

export type RouterConnectionStatus =
  | "unconfigured"
  | "pending"
  | "connected"
  | "error"
  | "mock";

export type RouterCatalogItem = {
  id: string;
  vendor: string;
  model: string;
  category: "backhaul" | "access-point" | "gateway" | "controller" | "cpe";
  adapterType: RouterAdapterType;
  tags: string[];
  description: string;
  defaultPort: number | null;
  supportsCaptivePortal: boolean;
  available: boolean;
};

export type Router = {
  id: string;
  ownerId: string;
  hotspotId: string | null;
  catalogId: string;
  vendor: string;
  model: string;
  adapterType: RouterAdapterType;
  label: string;
  host: string | null;
  port: number | null;
  username: string | null;
  /** Never return in list APIs; write-only on create/update */
  passwordStored: string | null;
  connectionStatus: RouterConnectionStatus;
  lastCheckedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicRouter = Omit<Router, "passwordStored">;

export type Hotspot = {
  id: string;
  ownerId: string;
  name: string;
  /** URL-safe name used in customer portal links, e.g. "accra-cafe-hotspot". */
  slug: string;
  ssid: string;
  address: string;
  status: HotspotStatus;
  qrPayload: string;
  routerId: string | null;
  latitude: number | null;
  longitude: number | null;
  /** When true, this site uses its own Free Mode window (not owner-wide). */
  freeModeEnabled: boolean;
  freeModeStartsAt: string | null;
  freeModeEndsAt: string | null;
  freeModePackageId: string | null;
  /**
   * When true (default), portal shows Paystack package checkout.
   * When false, package tab is hidden — voucher redeem only.
   */
  paystackEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HotspotWithRouter = Hotspot & {
  router: PublicRouter | null;
};

export type Customer = {
  id: string;
  email: string;
  name: string | null;
  hotspotId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Device = {
  id: string;
  customerId: string;
  name: string;
  macAddress: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionStatus = "active" | "expired" | "revoked";

export type DeviceSession = {
  id: string;
  hotspotId: string;
  packageId: string;
  customerId: string;
  deviceId: string;
  paymentId: string;
  status: SessionStatus;
  startsAt: string;
  endsAt: string;
  /** Cumulative download bytes sampled from MikroTik. */
  bytesDown: number;
  /** Cumulative upload bytes sampled from MikroTik. */
  bytesUp: number;
  /** Last Hotspot Active bytes-in from the router (for delta). */
  routerBytesIn: number;
  /** Last Hotspot Active bytes-out from the router (for delta). */
  routerBytesOut: number;
  bytesSampledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentStatus = "pending" | "success" | "failed";
export type PaymentProvider = "mock" | "paystack" | "voucher" | "free" | "roam";

export type Payment = {
  id: string;
  reference: string;
  hotspotId: string;
  packageId: string;
  subscriptionPlanId: string | null;
  customerEmail: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerRef: string | null;
  /** Captive-portal client MAC (normalized), when known. */
  clientMac: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionPlan = {
  id: string;
  ownerId: string;
  name: string;
  price: number;
  currency: string;
  speedProfile: string;
  dataLimitMb: number | null;
  intervalDays: number;
  hotspotId: string | null;
  linkedPackageId: string;
  enabled: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type Subscription = {
  id: string;
  ownerId: string;
  planId: string;
  customerEmail: string;
  hotspotId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  lastPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionListItem = Subscription & {
  planName: string;
  hotspotName: string;
  speedProfile: string;
  price: number;
  currency: string;
};

export type VoucherStatus = "unused" | "redeemed" | "expired" | "void";

export type VoucherBatch = {
  id: string;
  ownerId: string;
  packageId: string;
  hotspotId: string | null;
  label: string;
  quantity: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Voucher = {
  id: string;
  batchId: string;
  ownerId: string;
  packageId: string;
  hotspotId: string | null;
  code: string;
  status: VoucherStatus;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
  paymentId: string | null;
  expiresAt: string | null;
  /** Reseller holding this printed voucher; null = sold directly. */
  vendorId: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VoucherListItem = Voucher & {
  packageName: string;
  hotspotName: string | null;
  batchLabel: string;
  vendorName: string | null;
  price: number;
};

export type Vendor = {
  id: string;
  ownerId: string;
  name: string;
  phone: string | null;
  hotspotId: string | null;
  commissionPercent: number;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VendorCollection = {
  id: string;
  ownerId: string;
  vendorId: string;
  /** Cash received from the vendor. */
  amount: number;
  /** Vendor's cut for the sales settled; logged as an expense. */
  commissionAmount: number;
  currency: string;
  expenseId: string | null;
  collectedAt: string;
  notes: string | null;
  createdAt: string;
};

export type VendorStats = {
  vouchersGiven: number;
  vouchersSold: number;
  vouchersUnsold: number;
  vouchersVoid: number;
  /** Face value of unsold vouchers still with the vendor. */
  stockValue: number;
  /** Face value of vouchers customers redeemed. */
  salesValue: number;
  /** Commission earned on sales at the vendor's rate. */
  commissionDue: number;
  /** Sales minus commission — cash the vendor should hand over. */
  expectedCash: number;
  collected: number;
  commissionRecorded: number;
  /** Sales not yet covered by collections + recorded commission. */
  balance: number;
};

export type VendorWithStats = Vendor & {
  hotspotName: string | null;
  stats: VendorStats;
};

export type PortalTheme = {
  id: string;
  ownerId: string;
  hotspotId: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string;
  backgroundImageUrl: string | null;
  termsText: string;
  showPackages: boolean;
  showVoucherRedeem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentCallback = {
  id: string;
  paymentId: string;
  rawPayload: unknown;
  verified: boolean;
  createdAt: string;
};

export type NotificationType =
  | "payment_success"
  | "session_expired"
  | "system";

export type Notification = {
  id: string;
  ownerId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UsageLogEvent = "session_started";

export type UsageLog = {
  id: string;
  sessionId: string;
  hotspotId: string;
  event: UsageLogEvent;
  createdAt: string;
};

export type Database = {
  users: User[];
  packages: Package[];
  hotspots: Hotspot[];
  routers: Router[];
  customers: Customer[];
  devices: Device[];
  deviceSessions: DeviceSession[];
  payments: Payment[];
  paymentCallbacks: PaymentCallback[];
  notifications: Notification[];
  usageLogs: UsageLog[];
  voucherBatches: VoucherBatch[];
  vouchers: Voucher[];
  portalThemes: PortalTheme[];
  subscriptionPlans: SubscriptionPlan[];
  subscriptions: Subscription[];
};

export type PublicUser = Omit<User, "passwordHash">;

export type RuntimeSettings = {
  paymentMode: "mock" | "paystack";
  appUrl: string;
  webhookUrl: string;
  paystackConfigured: boolean;
  routerDefaultAdapter: RouterAdapterType;
  deploymentMode: "single-company";
  authMode: "supabase";
  /** Increments on every `npm run build` — use to confirm which deploy is live. */
  buildNumber: number;
  buildAt: string | null;
  mikrotik: {
    adapterMode: "mock" | "mikrotik";
    configured: boolean;
    host: string | null;
    /** True when at least one MikroTik has host+user saved in the UI. */
    routersConfigured: number;
  };
  /** Optional — fills the wizard WireGuard script for operators. */
  wireguard: {
    vpsPublicIp: string | null;
    vpsPublicKey: string | null;
    /** MikroTik tunnel private key — only returned to signed-in operators. */
    peerPrivateKey: string | null;
    serverAddress: string;
    peerAddress: string;
    listenPort: number;
    /** True when script can be pasted without placeholders. */
    scriptReady: boolean;
    /** Which of the three required keys are present (no values). */
    present: {
      vpsPublicIp: boolean;
      vpsPublicKey: boolean;
      peerPrivateKey: boolean;
    };
    /** Where the server looked for env (no secrets). */
    envCwd: string;
    envFilesLoaded: string[];
  };
};

export type SettingsPayload = {
  profile: PublicUser;
  runtime: RuntimeSettings;
  packages: Array<{ id: string; name: string; enabled: boolean }>;
  freeMode: {
    enabled: boolean;
    active: boolean;
    startsAt: string | null;
    endsAt: string | null;
    packageId: string | null;
  };
  stats: {
    hotspots: number;
    packages: number;
    routers: number;
    activeSessions: number;
  };
};

/** Portal payload when Free Mode window is live. */
export type PortalFreeMode = {
  active: boolean;
  endsAt: string;
  /** Short card title, e.g. "Free unlimited Wi‑Fi". */
  label: string;
  /** What the customer is getting, e.g. "Enjoy free unlimited internet for the rest of the day". */
  offer: string;
  /** Shown as duration under the title. */
  durationLabel: string;
  currency: string;
};

export type SessionListItem = DeviceSession & {
  hotspotName: string;
  packageName: string;
  customerEmail: string;
};

export type PaymentListItem = Payment & {
  hotspotName: string;
  packageName: string;
};

export type Expense = {
  id: string;
  ownerId: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  incurredAt: string;
  notes: string | null;
  /** Optional site; null = all locations / unassigned. */
  hotspotId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RevenueRangePreset =
  | "day"
  | "week"
  | "month"
  | "year"
  | "custom";

export type RevenueBucket = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  net: number;
  payments: number;
};

export type RevenueSummary = {
  from: string;
  to: string;
  currency: string;
  grossRevenue: number;
  expenseTotal: number;
  netProfit: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  voucherRevenue: number;
  paystackRevenue: number;
  mockRevenue: number;
  averageTicket: number;
  buckets: RevenueBucket[];
  payments: PaymentListItem[];
  expenses: Expense[];
};

export type PaystackSettlementRow = {
  id: number;
  status: string;
  currency: string;
  amount: number;
  totalAmount: number;
  effectiveAmount: number;
  deductedAmount: number;
  settlementDate: string | null;
  payoutDate: string | null;
};

export type PaystackTransactionRow = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  fees: number;
  currency: string;
  channel: string | null;
  paidAt: string | null;
  customerEmail: string | null;
};

export type DeviceListItem = Device & {
  customerEmail: string;
  hotspotId: string | null;
  hotspotName: string | null;
  packageName: string | null;
  speedProfile: string | null;
  sessionId: string | null;
  sessionStatus: SessionStatus | null;
  remainingMinutes: number | null;
  endsAt: string | null;
};

export type RouterTelemetryPoint = {
  at: string;
  downMbps: number;
  upMbps: number;
};

export type RouterDashboardItem = {
  /** May be empty string when equipment is not attached to a hotspot yet. */
  hotspotId: string;
  hotspotName: string;
  routerId: string | null;
  routerLabel: string | null;
  vendor: string | null;
  model: string | null;
  adapterType: RouterAdapterType | null;
  host: string | null;
  port: number | null;
  connectionStatus: RouterConnectionStatus | null;
  lastCheckedAt: string | null;
  online: boolean;
  internetUp: boolean;
  connectedUsers: number;
  bandwidthDownMbps: number;
  bandwidthUpMbps: number;
  cpuPercent: number;
  memoryPercent: number;
  message: string;
  traffic: RouterTelemetryPoint[];
};

export type CustomerPortalAccount = {
  email: string;
  hotspot: Hotspot;
  activeSessions: Array<{
    id: string;
    packageName: string;
    speedProfile: string;
    startsAt: string;
    endsAt: string;
    remainingMinutes: number;
    deviceName: string;
  }>;
  receipts: Array<{
    id: string;
    reference: string;
    packageName: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    provider: PaymentProvider;
    createdAt: string;
  }>;
  devices: Array<{
    id: string;
    name: string;
    macAddress: string | null;
    phone: string | null;
  }>;
  packages: Package[];
};

export type AnalyticsRange = "7d" | "30d" | "custom";

export type RevenueDay = {
  date: string;
  revenue: number;
  payments: number;
  sessions: number;
};

export type NamedRevenue = {
  id: string;
  name: string;
  revenue: number;
  count: number;
};

export type AnalyticsSummary = {
  range: AnalyticsRange;
  from: string;
  to: string;
  currency: string;
  revenue: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  activeSessions: number;
  totalSessions: number;
  avgTicket: number;
  successRate: number;
  revenueByDay: RevenueDay[];
  topPackages: NamedRevenue[];
  byHotspot: NamedRevenue[];
  peakHours: PeakHourBucket[];
  bandwidthByDay: BandwidthDay[];
  /** Total download bytes for sessions started in range. */
  totalBytesDown: number;
  /** Total upload bytes for sessions started in range. */
  totalBytesUp: number;
  activeSubscriptions: number;
};

export type PeakHourBucket = {
  hour: number;
  label: string;
  sessions: number;
  payments: number;
};

/** Daily download/upload GB attributed to sessions started that day. */
export type BandwidthDay = {
  date: string;
  downGb: number;
  upGb: number;
};
