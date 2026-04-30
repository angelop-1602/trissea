const PSGC_API_BASE = 'https://psgc.gitlab.io/api';
const PSGC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface PSGCProvince {
  code: string;
  name: string;
  regionCode: string;
  islandGroupCode?: string;
}

export interface PSGCRegion {
  code: string;
  name: string;
  regionName?: string;
}

export interface PSGCCity {
  code: string;
  name: string;
  regionCode: string;
  provinceCode: string;
}

export interface PSGCMunicipality {
  code: string;
  name: string;
  regionCode: string;
  provinceCode: string;
}

export interface PSGCCityMunicipality {
  code: string;
  name: string;
  regionCode: string;
  provinceCode: string;
  isCity: boolean;
  isMunicipality: boolean;
}

export interface PSGCProvinceOption {
  code: string;
  name: string;
  regionCode: string;
  regionName: string;
}

export type PSGCLGUType = 'province' | 'city' | 'municipality';

export interface PSGCLGUOption {
  code: string;
  name: string;
  lguType: PSGCLGUType;
  regionCode: string | null;
  regionName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
}

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const globalForPsgc = globalThis as unknown as {
  __trisseaPsgcCache: Map<string, CacheEntry<unknown>> | undefined;
};

const psgcCache = globalForPsgc.__trisseaPsgcCache ?? new Map<string, CacheEntry<unknown>>();
globalForPsgc.__trisseaPsgcCache = psgcCache;

function normalizeSearchTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bprovince of\b/g, ' ')
    .replace(/\bcity of\b/g, ' ')
    .replace(/\bprovince\b/g, ' ')
    .replace(/\bcity\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJsonWithCache<T>(cacheKey: string, url: string, ttlMs = PSGC_CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const cached = psgcCache.get(cacheKey) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PSGC API request failed (${response.status}).`);
    }

    const data = (await response.json()) as T;
    psgcCache.set(cacheKey, {
      data,
      expiresAt: now + ttlMs,
    });

    return data;
  } catch (error) {
    if (cached) {
      return cached.data;
    }

    const message = error instanceof Error ? error.message : 'Unknown PSGC API error.';
    throw new Error(`Unable to load PSGC data. ${message}`);
  }
}

export async function getPSGCRegions(): Promise<PSGCRegion[]> {
  return fetchJsonWithCache<PSGCRegion[]>('regions', `${PSGC_API_BASE}/regions/`);
}

export async function getPSGCProvinces(): Promise<PSGCProvince[]> {
  return fetchJsonWithCache<PSGCProvince[]>('provinces', `${PSGC_API_BASE}/provinces/`);
}

export async function getPSGCCities(): Promise<PSGCCity[]> {
  return fetchJsonWithCache<PSGCCity[]>('cities', `${PSGC_API_BASE}/cities/`);
}

export async function getPSGCMunicipalities(): Promise<PSGCMunicipality[]> {
  return fetchJsonWithCache<PSGCMunicipality[]>('municipalities', `${PSGC_API_BASE}/municipalities/`);
}

export async function getPSGCCitiesMunicipalities(): Promise<PSGCCityMunicipality[]> {
  return fetchJsonWithCache<PSGCCityMunicipality[]>(
    'cities-municipalities',
    `${PSGC_API_BASE}/cities-municipalities/`
  );
}

export async function searchPSGCProvinces(query: string): Promise<PSGCProvinceOption[]> {
  const normalizedQuery = normalizeSearchTerm(query);
  const [provinces, regions] = await Promise.all([getPSGCProvinces(), getPSGCRegions()]);

  const regionByCode = new Map(regions.map((region) => [region.code, region.name]));
  const options = provinces
    .map((province) => ({
      code: province.code,
      name: province.name,
      regionCode: province.regionCode,
      regionName: regionByCode.get(province.regionCode) ?? 'Unknown Region',
    }))
    .filter((province) => {
      if (!normalizedQuery) return true;
      return normalizeSearchTerm(province.name).includes(normalizedQuery);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return options.slice(0, 50);
}

export async function getPSGCProvinceByCode(code: string): Promise<PSGCProvinceOption | null> {
  const [provinces, regions] = await Promise.all([getPSGCProvinces(), getPSGCRegions()]);
  const province = provinces.find((item) => item.code === code);
  if (!province) {
    return null;
  }

  const region = regions.find((item) => item.code === province.regionCode);
  return {
    code: province.code,
    name: province.name,
    regionCode: province.regionCode,
    regionName: region?.name ?? 'Unknown Region',
  };
}

export async function searchPSGCLGUs(query: string): Promise<PSGCLGUOption[]> {
  const normalizedQuery = normalizeSearchTerm(query);

  const [regions, provinces, cities, municipalities] = await Promise.all([
    getPSGCRegions(),
    getPSGCProvinces(),
    getPSGCCities(),
    getPSGCMunicipalities(),
  ]);

  const regionByCode = new Map(regions.map((region) => [region.code, region.name]));
  const provinceByCode = new Map(provinces.map((province) => [province.code, province.name]));

  const lgus: PSGCLGUOption[] = [
    ...provinces.map((province) => ({
      code: province.code,
      name: province.name,
      lguType: 'province' as const,
      regionCode: province.regionCode ?? null,
      regionName: regionByCode.get(province.regionCode) ?? null,
      provinceCode: province.code,
      provinceName: province.name,
    })),
    ...cities.map((city) => ({
      code: city.code,
      name: city.name,
      lguType: 'city' as const,
      regionCode: city.regionCode ?? null,
      regionName: regionByCode.get(city.regionCode) ?? null,
      provinceCode: city.provinceCode ?? null,
      provinceName: city.provinceCode ? provinceByCode.get(city.provinceCode) ?? null : null,
    })),
    ...municipalities.map((municipality) => ({
      code: municipality.code,
      name: municipality.name,
      lguType: 'municipality' as const,
      regionCode: municipality.regionCode ?? null,
      regionName: regionByCode.get(municipality.regionCode) ?? null,
      provinceCode: municipality.provinceCode ?? null,
      provinceName: municipality.provinceCode
        ? provinceByCode.get(municipality.provinceCode) ?? null
        : null,
    })),
  ];

  const typePriority: Record<PSGCLGUType, number> = {
    city: 0,
    municipality: 1,
    province: 2,
  };

  return lgus
    .filter((item) => {
      if (!normalizedQuery) return true;
      return normalizeSearchTerm(item.name).includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (typePriority[a.lguType] !== typePriority[b.lguType]) {
        return typePriority[a.lguType] - typePriority[b.lguType];
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 80);
}

export async function getPSGCLGUByCode(code: string): Promise<PSGCLGUOption | null> {
  const [regions, provinces, cities, municipalities] = await Promise.all([
    getPSGCRegions(),
    getPSGCProvinces(),
    getPSGCCities(),
    getPSGCMunicipalities(),
  ]);

  const regionByCode = new Map(regions.map((region) => [region.code, region.name]));
  const provinceByCode = new Map(provinces.map((province) => [province.code, province.name]));

  const province = provinces.find((item) => item.code === code);
  if (province) {
    return {
      code: province.code,
      name: province.name,
      lguType: 'province',
      regionCode: province.regionCode,
      regionName: regionByCode.get(province.regionCode) ?? null,
      provinceCode: province.code,
      provinceName: province.name,
    };
  }

  const city = cities.find((item) => item.code === code);
  if (city) {
    return {
      code: city.code,
      name: city.name,
      lguType: 'city',
      regionCode: city.regionCode,
      regionName: regionByCode.get(city.regionCode) ?? null,
      provinceCode: city.provinceCode ?? null,
      provinceName: city.provinceCode ? provinceByCode.get(city.provinceCode) ?? null : null,
    };
  }

  const municipality = municipalities.find((item) => item.code === code);
  if (municipality) {
    return {
      code: municipality.code,
      name: municipality.name,
      lguType: 'municipality',
      regionCode: municipality.regionCode,
      regionName: regionByCode.get(municipality.regionCode) ?? null,
      provinceCode: municipality.provinceCode ?? null,
      provinceName: municipality.provinceCode ? provinceByCode.get(municipality.provinceCode) ?? null : null,
    };
  }

  return null;
}

export async function resolveProvinceCodeByName(name: string): Promise<string | null> {
  const normalized = normalizeSearchTerm(name);
  if (!normalized) {
    return null;
  }

  const provinces = await getPSGCProvinces();
  const exact = provinces.find((province) => normalizeSearchTerm(province.name) === normalized);
  if (exact) {
    return exact.code;
  }

  const partial = provinces.find((province) => normalizeSearchTerm(province.name).includes(normalized));
  return partial?.code ?? null;
}

export async function findPSGCCityMunicipalityByName(name: string): Promise<PSGCCityMunicipality | null> {
  const normalized = normalizeSearchTerm(name);
  if (!normalized) {
    return null;
  }

  const items = await getPSGCCitiesMunicipalities();
  const exact = items.find((item) => normalizeSearchTerm(item.name) === normalized);
  if (exact) {
    return exact;
  }

  const partial = items.find((item) => normalizeSearchTerm(item.name).includes(normalized));
  return partial ?? null;
}

export async function getPSGCRegionNameByCode(code: string): Promise<string | null> {
  const regions = await getPSGCRegions();
  const region = regions.find((item) => item.code === code);
  return region?.name ?? null;
}

