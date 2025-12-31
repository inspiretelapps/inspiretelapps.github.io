import type {
  ApiResponse,
  CallStats,
  CallRecord,
  Extension,
  IVR,
  Queue,
  InboundRoute,
} from '@/types';

// Simple cache implementation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 60000; // 1 minute

  get<T>(key: string, ttl: number = this.defaultTTL): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const apiCache = new ApiCache();

let accessToken: string | null = sessionStorage.getItem('yeastar_accessToken');
let pbxHost = '';
let proxyUrl = '';

export function setApiConfig(config: {
  pbxHost: string;
  proxyUrl: string;
  accessToken?: string;
}) {
  pbxHost = config.pbxHost;
  proxyUrl = config.proxyUrl;
  if (config.accessToken) {
    accessToken = config.accessToken;
    sessionStorage.setItem('yeastar_accessToken', config.accessToken);
  }
}

export function clearAccessToken() {
  accessToken = null;
  sessionStorage.removeItem('yeastar_accessToken');
}

/**
 * Make API request to Yeastar PBX
 */
export async function apiRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body: any = null,
  isRetry = false
): Promise<ApiResponse<T> | null> {
  if (!accessToken && !isRetry) {
    console.error('No access token available');
    return null;
  }

  // Build the target URL for the proxy
  const targetUrl = `${pbxHost}/openapi/v1.0/${endpoint.split('?')[0]}`;
  const params = new URLSearchParams(endpoint.split('?')[1] || '');
  if (accessToken) {
    params.append('access_token', accessToken);
  }

  const finalUrl = `${proxyUrl}/api/proxy/${targetUrl}?${params.toString()}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'YeastarDashboardWebApp',
      'X-Requested-With': 'XMLHttpRequest',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(finalUrl, options);
    const responseText = await response.text();

    let responseData: ApiResponse<T>;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('Parse error for ' + endpoint + ':', e);
      throw new Error(
        'PBX returned non-JSON response. Check CORS proxy configuration.'
      );
    }

    if (!responseData) {
      throw new Error('PBX returned empty data for ' + endpoint);
    }

    // Token expired
    if (responseData.errcode === 10004 && !isRetry) {
      console.log('Token expired, need to re-authenticate');
      clearAccessToken();
      throw new Error('Authentication expired. Please reconnect.');
    }

    if (!response.ok || (responseData.errcode && responseData.errcode !== 0)) {
      throw new Error(`API Error ${responseData.errcode}: ${responseData.errmsg}`);
    }

    return responseData;
  } catch (error) {
    console.error(`Error in apiRequest for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Get access token from Yeastar PBX
 */
export async function getAccessToken(
  host: string,
  clientId: string,
  clientSecret: string,
  proxyUrlParam: string
): Promise<string> {
  const targetUrl = `${host}/openapi/v1.0/get_token`;
  const url = `${proxyUrlParam}/api/proxy/${targetUrl}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'YeastarDashboardWebApp',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        username: clientId,
        password: clientSecret,
      }),
    });

    const responseText = await response.text();
    let data: ApiResponse;

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Auth parse error:', responseText.substring(0, 200));
      throw new Error(
        'Proxy/PBX returned invalid response. Check proxy configuration.'
      );
    }

    if (data.errcode === 0 && data.access_token) {
      sessionStorage.setItem('yeastar_accessToken', data.access_token);
      accessToken = data.access_token;
      return data.access_token;
    } else {
      throw new Error(
        `Auth failed: Error ${data.errcode}: ${data.errmsg || 'Unknown'}`
      );
    }
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

/**
 * Fetch all extensions
 */
export async function fetchExtensions(
  useCache = true
): Promise<Extension[]> {
  const cacheKey = 'extensions';
  if (useCache) {
    const cached = apiCache.get<Extension[]>(cacheKey);
    if (cached) return cached;
  }

  const result = await apiRequest<Extension[]>('extension/list?page_size=1000');
  if (result && result.data) {
    apiCache.set(cacheKey, result.data);
    return result.data;
  }
  return [];
}

/**
 * Fetch IVRs
 */
export async function fetchIVRs(useCache = true): Promise<IVR[]> {
  const cacheKey = 'ivrs';
  if (useCache) {
    const cached = apiCache.get<IVR[]>(cacheKey);
    if (cached) return cached;
  }

  const result = await apiRequest<IVR[]>('ivr/list?page_size=100');
  if (result && result.data) {
    apiCache.set(cacheKey, result.data);
    return result.data;
  }
  return [];
}

/**
 * Fetch queues
 */
export async function fetchQueues(useCache = true): Promise<Queue[]> {
  const cacheKey = 'queues';
  if (useCache) {
    const cached = apiCache.get<Queue[]>(cacheKey);
    if (cached) return cached;
  }

  const result = await apiRequest<any>('queue/list?page_size=100');
  if (result && result.errcode === 0) {
    const queues = ((result as any).queue_list || result.data || []) as Queue[];
    apiCache.set(cacheKey, queues);
    return queues;
  }
  return [];
}

/**
 * Fetch call statistics
 */
export async function fetchCallStats(
  extensionIds: string[],
  startTime: string,
  endTime: string
): Promise<CallStats[]> {
  if (extensionIds.length === 0) return [];

  const endpoint = `call_report/list?type=extcallstatistics&start_time=${encodeURIComponent(
    startTime
  )}&end_time=${encodeURIComponent(endTime)}&ext_id_list=${extensionIds.join(',')}`;

  const result = await apiRequest<any>(endpoint);

  if (result && result.errcode === 0) {
    return ((result as any).ext_call_statistics_list || result.data || []) as CallStats[];
  }
  return [];
}

/**
 * Fetch call detail records (CDR)
 */
export async function fetchCDR(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    startTime?: string;
    endTime?: string;
    extNum?: string;
    disposition?: string;
  }
): Promise<{ data: CallRecord[]; hasMore: boolean }> {
  let endpoint = `cdr/list?page_size=${pageSize}&sort_by=time&order_by=desc&page=${page}`;

  if (filters) {
    if (filters.startTime) {
      endpoint += `&start_time=${encodeURIComponent(filters.startTime)}`;
    }
    if (filters.endTime) {
      endpoint += `&end_time=${encodeURIComponent(filters.endTime)}`;
    }
    if (filters.extNum) {
      endpoint += `&ext_num=${filters.extNum}`;
    }
    if (filters.disposition) {
      endpoint += `&disposition=${filters.disposition}`;
    }
  }

  const result = await apiRequest<CallRecord[]>(endpoint);

  if (result && result.errcode === 0 && result.data) {
    return {
      data: result.data,
      hasMore: result.data.length >= pageSize,
    };
  }

  return { data: [], hasMore: false };
}

/**
 * Fetch inbound routes
 */
export async function fetchInboundRoutes(): Promise<InboundRoute[]> {
  const result = await apiRequest<InboundRoute[]>(
    'inbound_route/list?page_size=100&sort_by=pos&order_by=asc'
  );

  if (result && result.data) {
    return result.data;
  }
  return [];
}

/**
 * Get specific inbound route
 */
export async function getInboundRoute(id: number): Promise<InboundRoute | null> {
  const result = await apiRequest<InboundRoute>(`inbound_route/get?id=${id}`);

  if (result && result.errcode === 0 && result.data) {
    return result.data;
  }
  return null;
}

/**
 * Update inbound route
 */
export async function updateInboundRoute(
  route: Partial<InboundRoute> & { id: number }
): Promise<boolean> {
  const result = await apiRequest('inbound_route/update', 'POST', route);
  return result?.errcode === 0;
}

/**
 * Clear API cache
 */
export function clearApiCache(): void {
  apiCache.clear();
}
