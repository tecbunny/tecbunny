import type { CustomSetupBlueprintSummary, CustomSetupBlueprintComponentSummary } from '@/lib/custom-setup-service';

export type SetupSystem = 'analog' | 'ip';

export interface PriceEntry {
  id: string;
  label: string;
  mrp: number | null;
  sale: number;
}

export type CapacityPriceEntry = PriceEntry & {
  capacity: number;
};

export type CameraPriceMatrix = {
  standard: PriceEntry;
  dualLight: PriceEntry;
};

export type CablePriceEntry = {
  id: string;
  label: string;
  coverageMeters: number;
  mrpPerUnit: number;
  salePerUnit: number;
};

export interface AnalogPricing {
  dvr: CapacityPriceEntry[];
  smps: CapacityPriceEntry[];
  camera: Record<'2.4mp' | '5mp', CameraPriceMatrix>;
  cable: CablePriceEntry[];
}

export interface IpPricing {
  nvr: CapacityPriceEntry[];
  poe: CapacityPriceEntry[];
  camera: Record<'2mp' | '4mp', CameraPriceMatrix>;
  cable: CablePriceEntry[];
}

export const FALLBACK_ANALOG_PRICING: AnalogPricing = {
  dvr: [
    { id: 'dvr-4-2mp', label: '4 Channel DVR (2MP Model)', capacity: 4, mrp: 5199, sale: 2499 },
    { id: 'dvr-4-5mp', label: '4 Channel DVR (5MP Model)', capacity: 4, mrp: 5799, sale: 2799 },
    { id: 'dvr-8', label: '8 Channel DVR', capacity: 8, mrp: 6699, sale: 3799 },
    { id: 'dvr-16', label: '16 Channel DVR', capacity: 16, mrp: 19999, sale: 6999 },
    { id: 'dvr-32', label: '32 Channel DVR', capacity: 32, mrp: 32999, sale: 13999 },
  ],
  smps: [
    { id: 'smps-4', label: '4 Channel SMPS (5A)', capacity: 4, mrp: 1999, sale: 1249 },
    { id: 'smps-8', label: '8 Channel SMPS (10A)', capacity: 8, mrp: 2699, sale: 1699 },
    { id: 'smps-16', label: '16 Channel SMPS (20A)', capacity: 16, mrp: 3999, sale: 2599 },
  ],
  camera: {
    '2.4mp': {
      standard: { id: 'analog-2.4-standard', label: '2.4 MP Standard', mrp: 1899, sale: 1299 },
      dualLight: { id: 'analog-2.4-dual', label: '2.4 MP Dual-light', mrp: 2199, sale: 1499 },
    },
    '5mp': {
      standard: { id: 'analog-5-standard', label: '5 MP Standard', mrp: 2499, sale: 1799 },
      dualLight: { id: 'analog-5-dual', label: '5 MP Dual-light', mrp: 2899, sale: 2149 },
    },
  },
  cable: [
    { id: 'cable-coaxial-100m', label: 'CCTV Coaxial Cable (100m Roll)', coverageMeters: 100, mrpPerUnit: 3199, salePerUnit: 2499 },
  ],
};

export const FALLBACK_IP_PRICING: IpPricing = {
  nvr: [
    { id: 'nvr-8', label: '8 Channel NVR', capacity: 8, mrp: 8999, sale: 5499 },
    { id: 'nvr-16', label: '16 Channel NVR', capacity: 16, mrp: 12999, sale: 7899 },
    { id: 'nvr-32', label: '32 Channel NVR', capacity: 32, mrp: 18999, sale: 11499 },
  ],
  poe: [
    { id: 'poe-8', label: '8 Port PoE Switch', capacity: 8, mrp: 4999, sale: 3199 },
    { id: 'poe-16', label: '16 Port PoE Switch', capacity: 16, mrp: 6999, sale: 4499 },
    { id: 'poe-32', label: '32 Port PoE Switch', capacity: 32, mrp: 10999, sale: 6999 },
  ],
  camera: {
    '2mp': {
      standard: { id: 'ip-2-standard', label: '2 MP Standard', mrp: 3299, sale: 2399 },
      dualLight: { id: 'ip-2-dual', label: '2 MP Dual-light', mrp: 3699, sale: 2699 },
    },
    '4mp': {
      standard: { id: 'ip-4-standard', label: '4 MP Standard', mrp: 4199, sale: 2999 },
      dualLight: { id: 'ip-4-dual', label: '4 MP Dual-light', mrp: 4899, sale: 3699 },
    },
  },
  cable: [
    { id: 'cable-lan-100m', label: 'LAN Cable (100m Box)', coverageMeters: 100, mrpPerUnit: 3399, salePerUnit: 2699 },
  ],
};

export const FALLBACK_HDD_OPTIONS: PriceEntry[] = [
  { id: 'hdd-500', label: '500 GB Surveillance HDD', mrp: 3499, sale: 2699 },
  { id: 'hdd-1tb', label: '1 TB Surveillance HDD', mrp: 4499, sale: 3399 },
  { id: 'hdd-2tb', label: '2 TB Surveillance HDD', mrp: 5999, sale: 4699 },
];

export const FALLBACK_MONITOR_OPTION: PriceEntry = {
  id: 'monitor-19',
  label: '19" Surveillance Monitor',
  mrp: 9999,
  sale: 7499,
};

export const FALLBACK_MONITOR_OPTIONS: PriceEntry[] = [
  {
    id: 'monitor-19',
    label: '19" Surveillance Monitor',
    mrp: 9999,
    sale: 7499,
  },
  {
    id: 'monitor-21',
    label: '21" Surveillance Monitor',
    mrp: 12999,
    sale: 9999,
  },
  {
    id: 'monitor-24',
    label: '24" Surveillance Monitor',
    mrp: 15999,
    sale: 11999,
  },
];

export const FALLBACK_WALL_MOUNT_ADDON: PriceEntry = {
  id: 'wall-mount-addon',
  label: 'Wall Mount Installation Kit',
  mrp: 699,
  sale: 499,
};

export const FALLBACK_SPIKE_GUARD_OPTION: PriceEntry = {
  id: 'spike-guard',
  label: 'Spike Guard / Power Surge Protector',
  mrp: 1999,
  sale: 1299,
};

export const FALLBACK_RACK_OPTIONS: PriceEntry[] = [
  {
    id: 'rack-2u',
    label: 'Rack Cabinet - 2U',
    mrp: 4999,
    sale: 3299,
  },
  {
    id: 'rack-3u',
    label: 'Rack Cabinet - 3U',
    mrp: 5999,
    sale: 3999,
  },
  {
    id: 'rack-4u',
    label: 'Rack Cabinet - 4U',
    mrp: 6999,
    sale: 4599,
  },
];

export const FALLBACK_CONDUIT_PIPE_OPTIONS: PriceEntry[] = [
  {
    id: 'conduit-open',
    label: 'Open Conduit Pipe (₹10/mtr)',
    mrp: 10,
    sale: 10,
  },
  {
    id: 'conduit-concealed',
    label: 'Concealed Conduit Pipe (₹4/mtr)',
    mrp: 4,
    sale: 4,
  },
];

export const FALLBACK_INSTALLATION_OPTION: PriceEntry = {
  id: 'installation',
  label: 'On-site Installation & Configuration',
  mrp: 4500,
  sale: 4500,
};

const SALE_PRICE_METADATA_KEYS = ['sale_price', 'salePrice', 'offer_price', 'offerPrice', 'discounted_price', 'discountedPrice'];

export function readNumericMetadata(meta: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  const raw = meta[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const normalized = raw.replace(/[^0-9.\-]/g, '');
    if (!normalized.trim()) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readBooleanMetadata(meta: Record<string, unknown> | null | undefined, key: string): boolean | null {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  const raw = meta[key];
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['true', 'yes', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', '0'].includes(normalized)) {
      return false;
    }
  }
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
  }
  return null;
}

export function resolvePricePair(
  option: CustomSetupBlueprintComponentSummary['options'][number] | undefined,
  component: CustomSetupBlueprintComponentSummary | undefined,
  fallbackMrp: number,
  fallbackSale: number
): { mrp: number; sale: number } {
  const mrpSource = option?.unitPrice ?? component?.unitPrice ?? component?.basePrice ?? fallbackMrp;
  const saleMeta = option ? SALE_PRICE_METADATA_KEYS.map((key) => readNumericMetadata(option.metadata ?? null, key)).find((value) => value !== null) : null;
  const saleSource = saleMeta ?? fallbackSale ?? mrpSource;
  
  const rawMrp = Math.max(0, mrpSource || 0);
  const rawSale = Math.max(0, saleSource || 0);
  
  let mrp: number;
  let sale: number;
  
  if (rawMrp === 0 && rawSale > 0) {
    mrp = rawSale;
    sale = rawSale;
  } else if (rawMrp > 0 && rawSale > rawMrp) {
    mrp = rawMrp;
    sale = rawMrp;
  } else {
    mrp = rawMrp;
    sale = Math.min(rawSale, rawMrp);
  }
  
  return { mrp, sale };
}

export function parseChannelCapacity(label: string): number | null {
  const match = label.match(/(\d+)\s*channel/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCapacity(
  option: CustomSetupBlueprintComponentSummary['options'][number] | undefined,
  fallbackCapacity: number
): number {
  const metadataCapacity = option ? readNumericMetadata(option.metadata ?? null, 'channel_count') : null;
  if (metadataCapacity && Number.isFinite(metadataCapacity)) {
    return metadataCapacity;
  }
  if (option?.label) {
    const parsed = parseChannelCapacity(option.label);
    if (parsed) {
      return parsed;
    }
  }
  return fallbackCapacity;
}

export function normalizeMegapixels(
  option: CustomSetupBlueprintComponentSummary['options'][number] | undefined,
  fallback: number
): number {
  const metadataMp = option ? readNumericMetadata(option.metadata ?? null, 'megapixels') : null;
  if (metadataMp && Number.isFinite(metadataMp)) {
    return metadataMp;
  }
  if (option?.label) {
    const match = option.label.match(/(\d+(?:\.\d+)?)\s*mp/i);
    if (match) {
      const parsed = Number.parseFloat(match[1]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

export function buildCapacityEntries(
  component: CustomSetupBlueprintComponentSummary | undefined,
  fallback: CapacityPriceEntry[]
): CapacityPriceEntry[] {
  if (!component) {
    return fallback;
  }

  const fallbackByCapacity = new Map<number, CapacityPriceEntry>(
    fallback.map((entry) => [entry.capacity, entry])
  );

  const entries: CapacityPriceEntry[] = [];

  component.options.forEach((option, index) => {
    const fallbackByIndex = fallback[index] ?? fallback[0] ?? null;
    const fallbackCapacity = fallbackByIndex?.capacity ?? fallback[0]?.capacity ?? 1;
    const capacity = Math.max(1, Math.round(normalizeCapacity(option, fallbackCapacity)));
    const fallbackEntry = fallbackByCapacity.get(capacity) ?? fallbackByIndex;
    const fallbackMrp = fallbackEntry?.mrp ?? fallbackByIndex?.mrp ?? 0;
    const fallbackSale = fallbackEntry?.sale ?? fallbackByIndex?.sale ?? 0;
    const { mrp, sale } = resolvePricePair(option, component, fallbackMrp, fallbackSale);

    entries.push({
      id: option.id,
      label: option.label || fallbackEntry?.label || component.name,
      capacity,
      mrp,
      sale,
    });
  });

  fallback.forEach((entry) => {
    if (!entries.some((candidate) => candidate.capacity === entry.capacity)) {
      entries.push(entry);
    }
  });

  return entries.sort((a, b) => a.capacity - b.capacity);
}

export function buildCableEntries(
  component: CustomSetupBlueprintComponentSummary | undefined,
  fallback: CablePriceEntry[]
): CablePriceEntry[] {
  if (!component) {
    return fallback;
  }

  return fallback.map((entry) => {
    const option = component.options.find((candidate) => {
      const label = candidate.label?.toLowerCase() ?? '';
      const fallbackLower = entry.label.toLowerCase();
      if (fallbackLower.includes('lan') && label.includes('lan')) {
        return true;
      }
      if (fallbackLower.includes('coaxial') && (label.includes('coax') || label.includes('rg59'))) {
        return true;
      }
      return false;
    });

    if (!option) {
      return entry;
    }

    const coverage = readNumericMetadata(option.metadata ?? null, 'coverage_m') ?? entry.coverageMeters;
    const { mrp, sale } = resolvePricePair(option, component, entry.mrpPerUnit, entry.salePerUnit);

    return {
      id: option.id,
      label: option.label || entry.label,
      coverageMeters: coverage,
      mrpPerUnit: mrp,
      salePerUnit: sale,
    } satisfies CablePriceEntry;
  });
}

export function buildCameraMatrix(
  component: CustomSetupBlueprintComponentSummary | undefined,
  resolutionKey: '2.4mp' | '5mp' | '2mp' | '4mp',
  fallback: CameraPriceMatrix
): CameraPriceMatrix {
  if (!component) {
    return fallback;
  }

  const targetMp = Number.parseFloat(resolutionKey.replace('mp', ''));

  const findOption = (dual: boolean) => {
    return component.options.find((option) => {
      const mp = normalizeMegapixels(option, targetMp);
      if (Math.abs(mp - targetMp) > 0.11) {
        return false;
      }
      const metaDual = readBooleanMetadata(option.metadata ?? null, 'dual_light');
      const label = option.label?.toLowerCase() ?? '';
      const isDual = metaDual ?? /dual/.test(label) ?? /two light/.test(label);
      return dual ? isDual : !isDual;
    });
  };

  const standardOption = findOption(false) ?? findOption(true);
  const dualOption = findOption(true) ?? standardOption;

  const standardPricing = standardOption
    ? (() => {
        const { mrp, sale } = resolvePricePair(standardOption, component, fallback.standard.mrp ?? 0, fallback.standard.sale);
        return {
          id: standardOption.id,
          label: standardOption.label || fallback.standard.label,
          mrp,
          sale,
        } satisfies PriceEntry;
      })()
    : fallback.standard;

  const dualPricing = dualOption
    ? (() => {
        const { mrp, sale } = resolvePricePair(dualOption, component, fallback.dualLight.mrp ?? 0, fallback.dualLight.sale);
        return {
          id: dualOption.id,
          label: dualOption.label || fallback.dualLight.label,
          mrp,
          sale,
        } satisfies PriceEntry;
      })()
    : fallback.dualLight;

  return {
    standard: standardPricing,
    dualLight: dualPricing,
  } satisfies CameraPriceMatrix;
}

export function buildHddOptionsFromComponents(
  components: Array<CustomSetupBlueprintComponentSummary | undefined>,
  fallback: PriceEntry[]
): PriceEntry[] {
  const entries: PriceEntry[] = [];
  const seen = new Set<string>();

  for (const component of components) {
    if (!component) continue;
    component.options.forEach((option) => {
      const label = option.label ?? '';
      const capacityMatch = label.match(/(\d+(?:\.\d+)?)\s*(tb|gb)/i);
      const key = capacityMatch ? capacityMatch[0].toLowerCase() : option.id;
      if (seen.has(key)) {
        return;
      }
      const { mrp, sale } = resolvePricePair(option, component, option.unitPrice ?? component.unitPrice ?? component.basePrice ?? 0, option.unitPrice ?? component.unitPrice ?? component.basePrice ?? 0);
      entries.push({
        id: option.id,
        label: label || 'Storage option',
        mrp,
        sale,
      });
      seen.add(key);
    });
  }

  if (!entries.length) {
    return fallback;
  }

  return entries.sort((a, b) => a.label.localeCompare(b.label));
}

export function pickFirstOption(component: CustomSetupBlueprintComponentSummary | undefined): PriceEntry | null {
  if (!component || !component.options.length) {
    return null;
  }
  const option = component.options[0];
  const { mrp, sale } = resolvePricePair(option, component, option.unitPrice ?? component.unitPrice ?? component.basePrice ?? 0, option.unitPrice ?? component.unitPrice ?? component.basePrice ?? 0);
  return {
    id: option.id,
    label: option.label ?? component.name,
    mrp,
    sale,
  } satisfies PriceEntry;
}

export function buildPricingCatalog(blueprint: CustomSetupBlueprintSummary | null): {
  analog: AnalogPricing;
  ip: IpPricing;
  hddOptions: PriceEntry[];
  monitorOption: PriceEntry;
  installationOption: PriceEntry;
} {
  if (!blueprint) {
    return {
      analog: FALLBACK_ANALOG_PRICING,
      ip: FALLBACK_IP_PRICING,
      hddOptions: FALLBACK_HDD_OPTIONS,
      monitorOption: FALLBACK_MONITOR_OPTION,
      installationOption: FALLBACK_INSTALLATION_OPTION,
    };
  }

  const analogSystem = blueprint.systems.find((system) => system.slug === 'dvr-system');
  const ipSystem = blueprint.systems.find((system) => system.slug === 'nvr-system');

  const analogPricing: AnalogPricing = {
    dvr: buildCapacityEntries(
      analogSystem?.components.find((component) => component.slug === 'dvr-recorder'),
      FALLBACK_ANALOG_PRICING.dvr
    ),
    smps: buildCapacityEntries(
      analogSystem?.components.find((component) => component.slug === 'smps-power'),
      FALLBACK_ANALOG_PRICING.smps
    ),
    camera: {
      '2.4mp': buildCameraMatrix(
        analogSystem?.components.find((component) => component.slug === 'analog-camera'),
        '2.4mp',
        FALLBACK_ANALOG_PRICING.camera['2.4mp']
      ),
      '5mp': buildCameraMatrix(
        analogSystem?.components.find((component) => component.slug === 'analog-camera'),
        '5mp',
        FALLBACK_ANALOG_PRICING.camera['5mp']
      ),
    },
    cable: buildCableEntries(
      analogSystem?.components.find((component) => component.slug === 'coaxial-cable'),
      FALLBACK_ANALOG_PRICING.cable
    ),
  } satisfies AnalogPricing;

  const ipPricing: IpPricing = {
    nvr: buildCapacityEntries(
      ipSystem?.components.find((component) => component.slug === 'nvr-recorder'),
      FALLBACK_IP_PRICING.nvr
    ),
    poe: buildCapacityEntries(
      ipSystem?.components.find((component) => component.slug === 'poe-switch'),
      FALLBACK_IP_PRICING.poe
    ),
    camera: {
      '2mp': buildCameraMatrix(
        ipSystem?.components.find((component) => component.slug === 'ip-camera'),
        '2mp',
        FALLBACK_IP_PRICING.camera['2mp']
      ),
      '4mp': buildCameraMatrix(
        ipSystem?.components.find((component) => component.slug === 'ip-camera'),
        '4mp',
        FALLBACK_IP_PRICING.camera['4mp']
      ),
    },
    cable: buildCableEntries(
      ipSystem?.components.find((component) => component.slug === 'cat6-cable'),
      FALLBACK_IP_PRICING.cable
    ),
  } satisfies IpPricing;

  const hddOptions = buildHddOptionsFromComponents(
    [
      analogSystem?.components.find((component) => component.slug === 'dvr-storage'),
      ipSystem?.components.find((component) => component.slug === 'nvr-storage'),
    ],
    FALLBACK_HDD_OPTIONS
  );

  const monitorComponent =
    analogSystem?.components.find((component) => component.slug.includes('monitor')) ??
    ipSystem?.components.find((component) => component.slug.includes('monitor'));

  const installationComponent =
    analogSystem?.components.find((component) => component.slug === 'installation-service') ??
    ipSystem?.components.find((component) => component.slug === 'installation-service');

  const monitorOption = pickFirstOption(monitorComponent) ?? FALLBACK_MONITOR_OPTION;
  const installationOption = pickFirstOption(installationComponent) ?? FALLBACK_INSTALLATION_OPTION;

  return {
    analog: analogPricing,
    ip: ipPricing,
    hddOptions,
    monitorOption,
    installationOption,
  };
}

export function pickCapacityOption(options: CapacityPriceEntry[], cameraCount: number): CapacityPriceEntry {
  const sorted = [...options].sort((a, b) => a.capacity - b.capacity);
  return sorted.find((entry) => entry.capacity >= cameraCount) ?? sorted[sorted.length - 1];
}

export function calculateQuantity(cameraCount: number, capacity: number): number {
  if (capacity <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(cameraCount / capacity));
}

const AVERAGE_RUN_METERS_PER_CAMERA = 25;
const INSTALLATION_LABOR_PER_CAMERA = 299;
const INSTALLATION_SETUP_CONFIGURATION_COST = 1000;
const INSTALLATION_LABOR_PER_METER_CABLE = 2;

export function calculateCableQuantity(cameraCount: number, cable: CablePriceEntry): number {
  const totalRun = Math.max(1, cameraCount) * AVERAGE_RUN_METERS_PER_CAMERA;
  const coverage = Math.max(1, cable.coverageMeters);
  return Math.max(1, Math.ceil(totalRun / coverage));
}

export function calculateCableMetersForLabor(cameraCount: number): number {
  return cameraCount > 0 ? cameraCount * AVERAGE_RUN_METERS_PER_CAMERA : 0;
}

export function roundUpToThousandMinusOne(value: number): number {
  if (value <= 0) {
    return 0;
  }
  return Math.max(0, Math.ceil(value / 1000) * 1000 - 1);
}

export function calculateInstallationLaborCharges(cameraCount: number): {
  sale: number;
  breakdown: string[];
} {
  const cameraCountClamped = Math.max(0, cameraCount);
  const cameraLaborCost = cameraCountClamped * INSTALLATION_LABOR_PER_CAMERA;
  const cableMeters = calculateCableMetersForLabor(cameraCountClamped);
  const cableLaborCost = cableMeters * INSTALLATION_LABOR_PER_METER_CABLE;
  const setupConfigCost = cameraCountClamped > 0 ? INSTALLATION_SETUP_CONFIGURATION_COST : 0;
  const rawTotal = cameraLaborCost + cableLaborCost + setupConfigCost;

  const breakdown: string[] = [];
  if (cameraCountClamped > 0) {
    breakdown.push(`${cameraCountClamped} camera installation @ ₹${INSTALLATION_LABOR_PER_CAMERA}/unit`);
    breakdown.push(`${cableMeters} m cable laying @ ₹${INSTALLATION_LABOR_PER_METER_CABLE}/m`);
    breakdown.push(`Setup & configuration: ₹${INSTALLATION_SETUP_CONFIGURATION_COST}`);
  }

  return {
    sale: roundUpToThousandMinusOne(rawTotal),
    breakdown,
  };
}

export function recommendedAnalogDvrCapacity(cameraCount: number): number {
  if (cameraCount <= 4) {
    return 4;
  }
  if (cameraCount <= 8) {
    return 8;
  }
  if (cameraCount <= 16) {
    return 16;
  }
  return 32;
}

export function recommendedAnalogSmpsCapacity(cameraCount: number): number {
  if (cameraCount <= 4) {
    return 4;
  }
  if (cameraCount <= 8) {
    return 8;
  }
  return 16;
}

export function recommendedIpCapacity(cameraCount: number): number {
  if (cameraCount <= 8) {
    return 8;
  }
  if (cameraCount <= 16) {
    return 16;
  }
  return 32;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(value));
}

export interface AnalogSelections {
  dvrId: string;
  smpsId: string;
  cableId: string;
  resolution: '2.4mp' | '5mp';
  dualLight: boolean;
}

export interface IpSelections {
  nvrId: string;
  poeId: string;
  cableId: string;
  resolution: '2mp' | '4mp';
  dualLight: boolean;
}

export interface Totals {
  system: { mrp: number; sale: number; breakdown: string[] };
  hdd: { mrp: number; sale: number; label: string };
  monitor: { mrp: number; sale: number; included: boolean; label: string };
  wallMount: { mrp: number; sale: number; included: boolean };
  spikeGuard: { mrp: number; sale: number; included: boolean };
  rack: { mrp: number; sale: number; selected: boolean; label: string };
  conduit: { mrp: number; sale: number; selected: boolean; label: string; meters: number };
  installation: { mrp: number; sale: number; included: boolean };
  installationLabor: { sale: number; breakdown: string[] };
  overall: { mrp: number; sale: number; discountAmount: number; discountPercent: number };
}

export function buildAnalogSystemSummary(cameraCount: number, selections: AnalogSelections, pricing: AnalogPricing): {
  mrp: number;
  sale: number;
  breakdown: string[];
} {
  const dvr = pricing.dvr.find((entry) => entry.id === selections.dvrId) ?? pricing.dvr[0];
  const smps = pricing.smps.find((entry) => entry.id === selections.smpsId) ?? pricing.smps[0];
  const cable = pricing.cable.find((entry) => entry.id === selections.cableId) ?? pricing.cable[0];
  const cameraMatrix = pricing.camera[selections.resolution];
  const cameraPricing = selections.dualLight ? cameraMatrix.dualLight : cameraMatrix.standard;

  const smpsQuantity = calculateQuantity(cameraCount, smps.capacity);
  const cableQuantity = calculateCableQuantity(cameraCount, cable);

  const mrp =
    (dvr.mrp ?? 0) +
    (smps.mrp ?? 0) * smpsQuantity +
    (cameraPricing.mrp ?? 0) * cameraCount +
    (cable.mrpPerUnit ?? 0) * cableQuantity;
  const sale =
    dvr.sale +
    smps.sale * smpsQuantity +
    cameraPricing.sale * cameraCount +
    cable.salePerUnit * cableQuantity;

  const breakdown: string[] = [
    `${dvr.label} (${formatCurrency(dvr.sale)})`,
    `${smpsQuantity} × ${smps.label} (${formatCurrency(smps.sale * smpsQuantity)})`,
    `${cameraCount} × ${cameraPricing.label} (${formatCurrency(cameraPricing.sale * cameraCount)})`,
    `${cableQuantity} × ${cable.label} (${formatCurrency(cable.salePerUnit * cableQuantity)})`,
  ];

  return { mrp, sale, breakdown };
}

export function buildIpSystemSummary(cameraCount: number, selections: IpSelections, pricing: IpPricing): {
  mrp: number;
  sale: number;
  breakdown: string[];
} {
  const nvr = pricing.nvr.find((entry) => entry.id === selections.nvrId) ?? pricing.nvr[0];
  const poe = pricing.poe.find((entry) => entry.id === selections.poeId) ?? pricing.poe[0];
  const cable = pricing.cable.find((entry) => entry.id === selections.cableId) ?? pricing.cable[0];
  const cameraMatrix = pricing.camera[selections.resolution];
  const cameraPricing = selections.dualLight ? cameraMatrix.dualLight : cameraMatrix.standard;

  const poeQuantity = calculateQuantity(cameraCount, poe.capacity);
  const cableQuantity = calculateCableQuantity(cameraCount, cable);

  const mrp =
    (nvr.mrp ?? 0) +
    (poe.mrp ?? 0) * poeQuantity +
    (cameraPricing.mrp ?? 0) * cameraCount +
    (cable.mrpPerUnit ?? 0) * cableQuantity;
  const sale =
    nvr.sale +
    poe.sale * poeQuantity +
    cameraPricing.sale * cameraCount +
    cable.salePerUnit * cableQuantity;

  const breakdown: string[] = [
    `${nvr.label} (${formatCurrency(nvr.sale)})`,
    `${poeQuantity} × ${poe.label} (${formatCurrency(poe.sale * poeQuantity)})`,
    `${cameraCount} × ${cameraPricing.label} (${formatCurrency(cameraPricing.sale * cameraCount)})`,
    `${cableQuantity} × ${cable.label} (${formatCurrency(cable.salePerUnit * cableQuantity)})`,
  ];

  return { mrp, sale, breakdown };
}

export interface CalculateTotalsInput {
  system: SetupSystem;
  cameraCount: number;
  analogSelections: AnalogSelections;
  ipSelections: IpSelections;
  hddId: string;
  monitorIncluded: boolean;
  monitorId?: string;
  wallMountIncluded?: boolean;
  spikeGuardIncluded?: boolean;
  rackId?: string | null;
  conduitPipeId?: string | null;
  conduitMeters?: number;
  installationIncluded: boolean;
  automationEnabled?: boolean;
  pricingCatalog: ReturnType<typeof buildPricingCatalog>;
  accessoryPricingOverrides?: Record<string, { mrp: number; sale: number }> | null;
}

export function resolveAccessoryPrice(
  id: string,
  defaultMrp: number,
  defaultSale: number,
  overrides?: Record<string, { mrp: number; sale: number }> | null
): { mrp: number; sale: number } {
  if (overrides && overrides[id]) {
    const override = overrides[id];
    return {
      mrp: typeof override.mrp === 'number' ? override.mrp : (typeof override.sale === 'number' ? override.sale : defaultMrp),
      sale: typeof override.sale === 'number' ? override.sale : defaultSale,
    };
  }
  return { mrp: defaultMrp, sale: defaultSale };
}

export function calculateTotals({
  system,
  cameraCount,
  analogSelections,
  ipSelections,
  hddId,
  monitorIncluded,
  monitorId = 'monitor-19',
  wallMountIncluded = false,
  spikeGuardIncluded = false,
  rackId = null,
  conduitPipeId = null,
  conduitMeters = 0,
  installationIncluded,
  automationEnabled = false,
  pricingCatalog,
  accessoryPricingOverrides = null,
}: CalculateTotalsInput): Totals {
  const analogPricing = pricingCatalog.analog;
  const ipPricing = pricingCatalog.ip;
  const selectableHddOptions = pricingCatalog.hddOptions.length ? pricingCatalog.hddOptions : FALLBACK_HDD_OPTIONS;
  const monitorOption = FALLBACK_MONITOR_OPTIONS.find((entry) => entry.id === monitorId) ?? FALLBACK_MONITOR_OPTIONS[0];
  const installationOption = pricingCatalog.installationOption;

  const systemSummary = system === 'analog'
    ? buildAnalogSystemSummary(cameraCount, analogSelections, analogPricing)
    : buildIpSystemSummary(cameraCount, ipSelections, ipPricing);

  const installationLaborCharges = installationIncluded ? calculateInstallationLaborCharges(cameraCount) : { sale: 0, breakdown: [] };

  // Resolve HDD
  const hdd = selectableHddOptions.find((entry) => entry.id === hddId) ?? selectableHddOptions[0];
  const resolvedHddPrice = resolveAccessoryPrice(hdd.id, hdd.mrp ?? 0, hdd.sale, accessoryPricingOverrides);

  // Resolve Monitor
  const resolvedMonitorPrice = resolveAccessoryPrice(monitorOption.id, monitorOption.mrp ?? 0, monitorOption.sale, accessoryPricingOverrides);
  const monitorMrp = monitorIncluded ? resolvedMonitorPrice.mrp : 0;
  const monitorSale = monitorIncluded ? resolvedMonitorPrice.sale : 0;

  // Resolve Installation (using dynamic installation labor charges)
  const installationMrp = installationLaborCharges.sale;
  const installationSale = installationLaborCharges.sale;

  // Resolve Wall Mount Addon
  const resolvedWallMountPrice = resolveAccessoryPrice(
    'wall-mount-addon',
    FALLBACK_WALL_MOUNT_ADDON.mrp ?? 0,
    FALLBACK_WALL_MOUNT_ADDON.sale,
    accessoryPricingOverrides
  );
  const wallMountMrp = (monitorIncluded && wallMountIncluded) ? resolvedWallMountPrice.mrp : 0;
  const wallMountSale = (monitorIncluded && wallMountIncluded) ? resolvedWallMountPrice.sale : 0;

  // Resolve Spike Guard
  const resolvedSpikeGuardPrice = resolveAccessoryPrice(
    'spike-guard',
    FALLBACK_SPIKE_GUARD_OPTION.mrp ?? 0,
    FALLBACK_SPIKE_GUARD_OPTION.sale,
    accessoryPricingOverrides
  );
  const spikeGuardMrp = spikeGuardIncluded ? resolvedSpikeGuardPrice.mrp : 0;
  const spikeGuardSale = spikeGuardIncluded ? resolvedSpikeGuardPrice.sale : 0;

  // Resolve Rack Cabinet
  let rackMrp = 0;
  let rackSale = 0;
  let rackLabel = 'None';
  if (rackId) {
    const rackOption = FALLBACK_RACK_OPTIONS.find((entry) => entry.id === rackId);
    if (rackOption) {
      const resolvedRackPrice = resolveAccessoryPrice(
        rackOption.id,
        rackOption.mrp ?? 0,
        rackOption.sale,
        accessoryPricingOverrides
      );
      rackMrp = resolvedRackPrice.mrp;
      rackSale = resolvedRackPrice.sale;
      rackLabel = rackOption.label;
    }
  }

  // Resolve Conduit Pipe
  let conduitMrp = 0;
  let conduitSale = 0;
  let conduitLabel = 'None';
  if (conduitPipeId && conduitMeters > 0) {
    const conduitOption = FALLBACK_CONDUIT_PIPE_OPTIONS.find((entry) => entry.id === conduitPipeId);
    if (conduitOption) {
      const resolvedConduitPrice = resolveAccessoryPrice(
        conduitOption.id,
        conduitOption.mrp ?? 0,
        conduitOption.sale,
        accessoryPricingOverrides
      );
      conduitMrp = resolvedConduitPrice.mrp * conduitMeters;
      conduitSale = resolvedConduitPrice.sale * conduitMeters;
      conduitLabel = conduitOption.label;
    }
  }

  const overallMrp =
    systemSummary.mrp +
    resolvedHddPrice.mrp +
    monitorMrp +
    installationMrp +
    wallMountMrp +
    spikeGuardMrp +
    rackMrp +
    conduitMrp;

  const overallSale =
    systemSummary.sale +
    resolvedHddPrice.sale +
    monitorSale +
    installationSale +
    wallMountSale +
    spikeGuardSale +
    rackSale +
    conduitSale;
  
  const validatedMrp = Math.max(overallMrp, overallSale);
  const validatedSale = Math.min(overallSale, validatedMrp);
  
  const discountAmount = Math.max(0, Math.round(validatedMrp - validatedSale));
  const discountPercent = validatedMrp > 0 ? (discountAmount / validatedMrp) * 100 : 0;

  return {
    system: systemSummary,
    hdd: { mrp: resolvedHddPrice.mrp, sale: resolvedHddPrice.sale, label: hdd.label },
    monitor: { mrp: monitorMrp, sale: monitorSale, included: monitorIncluded, label: monitorOption.label },
    wallMount: { mrp: wallMountMrp, sale: wallMountSale, included: monitorIncluded && wallMountIncluded },
    spikeGuard: { mrp: spikeGuardMrp, sale: spikeGuardSale, included: spikeGuardIncluded },
    rack: { mrp: rackMrp, sale: rackSale, selected: !!rackId, label: rackLabel },
    conduit: { mrp: conduitMrp, sale: conduitSale, selected: !!conduitPipeId && conduitMeters > 0, label: conduitLabel, meters: conduitMeters },
    installation: { mrp: installationMrp, sale: installationSale, included: installationIncluded },
    installationLabor: { sale: 0, breakdown: installationLaborCharges.breakdown },
    overall: {
      mrp: validatedMrp,
      sale: validatedSale,
      discountAmount,
      discountPercent,
    },
  };
}
