export type IndianStateTaxInfo = {
  code: string;
  name: string;
};

const STATE_ALIASES: Record<string, IndianStateTaxInfo> = {
  'andaman and nicobar islands': { code: '35', name: 'Andaman and Nicobar Islands' },
  'andhra pradesh': { code: '37', name: 'Andhra Pradesh' },
  'andhrapradesh': { code: '37', name: 'Andhra Pradesh' },
  'arunachal pradesh': { code: '12', name: 'Arunachal Pradesh' },
  assam: { code: '18', name: 'Assam' },
  bihar: { code: '10', name: 'Bihar' },
  chandigarh: { code: '04', name: 'Chandigarh' },
  chhattisgarh: { code: '22', name: 'Chhattisgarh' },
  'dadra and nagar haveli and daman and diu': { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  'dadra and nagar haveli': { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  'daman and diu': { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  delhi: { code: '07', name: 'Delhi' },
  'new delhi': { code: '07', name: 'Delhi' },
  goa: { code: '30', name: 'Goa' },
  gujarat: { code: '24', name: 'Gujarat' },
  haryana: { code: '06', name: 'Haryana' },
  'himachal pradesh': { code: '02', name: 'Himachal Pradesh' },
  'jammu and kashmir': { code: '01', name: 'Jammu and Kashmir' },
  jharkhand: { code: '20', name: 'Jharkhand' },
  karnataka: { code: '29', name: 'Karnataka' },
  kerala: { code: '32', name: 'Kerala' },
  ladakh: { code: '38', name: 'Ladakh' },
  lakshadweep: { code: '31', name: 'Lakshadweep' },
  'madhya pradesh': { code: '23', name: 'Madhya Pradesh' },
  maharashtra: { code: '27', name: 'Maharashtra' },
  manipur: { code: '14', name: 'Manipur' },
  meghalaya: { code: '17', name: 'Meghalaya' },
  mizoram: { code: '15', name: 'Mizoram' },
  nagaland: { code: '13', name: 'Nagaland' },
  odisha: { code: '21', name: 'Odisha' },
  orissa: { code: '21', name: 'Odisha' },
  puducherry: { code: '34', name: 'Puducherry' },
  pondicherry: { code: '34', name: 'Puducherry' },
  punjab: { code: '03', name: 'Punjab' },
  rajasthan: { code: '08', name: 'Rajasthan' },
  sikkim: { code: '11', name: 'Sikkim' },
  'tamil nadu': { code: '33', name: 'Tamil Nadu' },
  tamilnadu: { code: '33', name: 'Tamil Nadu' },
  telangana: { code: '36', name: 'Telangana' },
  tripura: { code: '16', name: 'Tripura' },
  'uttar pradesh': { code: '09', name: 'Uttar Pradesh' },
  uttarakhand: { code: '05', name: 'Uttarakhand' },
  uttaranchal: { code: '05', name: 'Uttarakhand' },
  'west bengal': { code: '19', name: 'West Bengal' },
};

const CODE_LOOKUP = new Map(
  Object.values(STATE_ALIASES).map((state) => [state.code, state] as const),
);

function normalizeStateKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

export function resolveIndianStateInfo(value: unknown): IndianStateTaxInfo | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const codeMatch = trimmed.match(/^\d{2}$/);
  if (codeMatch) {
    return CODE_LOOKUP.get(trimmed) ?? null;
  }

  return STATE_ALIASES[normalizeStateKey(trimmed)] ?? null;
}

export function resolveIndianStateFromText(value: unknown): IndianStateTaxInfo | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalizedText = normalizeStateKey(value);
  const matches = Object.entries(STATE_ALIASES)
    .filter(([alias]) => {
      const normalizedAlias = normalizeStateKey(alias);
      return new RegExp(`(^|\\W)${normalizedAlias.replace(/\s+/g, '\\s+')}($|\\W)`).test(normalizedText);
    })
    .map(([, state]) => state);

  return matches[0] ?? null;
}

export function formatPlaceOfSupply(stateInfo: IndianStateTaxInfo | null, fallbackState?: string | null): string {
  if (stateInfo) {
    return `${stateInfo.code} - ${stateInfo.name}`;
  }

  return fallbackState?.trim() || 'Not captured';
}

export const TECBUNNY_REGISTERED_STATE: IndianStateTaxInfo = { code: '30', name: 'Goa' };
