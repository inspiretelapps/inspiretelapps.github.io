import type {
  ApiResponse,
  CallStats,
  CallRecord,
  Extension,
  IVR,
  Queue,
  InboundRoute,
  ExtensionStatus,
  QueueStatus,
  ActiveCall,
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
  // Ensure pbxHost has protocol
  const normalizedHost = pbxHost.startsWith('http://') || pbxHost.startsWith('https://')
    ? pbxHost
    : `https://${pbxHost}`;

  const targetUrl = `${normalizedHost}/openapi/v1.0/${endpoint.split('?')[0]}`;
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
  // Ensure host has protocol
  const normalizedHost = host.startsWith('http://') || host.startsWith('https://')
    ? host
    : `https://${host}`;

  const targetUrl = `${normalizedHost}/openapi/v1.0/get_token`;
  const url = `${proxyUrlParam}/api/proxy/${targetUrl}`;

  console.log('Authentication request URL:', url);
  console.log('Target PBX URL:', targetUrl);

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

    console.log('Response status:', response.status);
    console.log('Response text:', responseText.substring(0, 500));

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Auth parse error:', responseText.substring(0, 200));
      throw new Error(
        'Proxy/PBX returned invalid response. Check proxy configuration and ensure CORS is enabled.'
      );
    }

    if (data.errcode === 0 && data.access_token) {
      sessionStorage.setItem('yeastar_accessToken', data.access_token);
      accessToken = data.access_token;
      console.log('Authentication successful');
      return data.access_token;
    } else {
      const errorMsg = `Auth failed: Error ${data.errcode}: ${data.errmsg || 'Unknown error'}`;
      console.error(errorMsg);
      console.error('Common errors:');
      console.error('- Error 10003: Invalid username/password');
      console.error('- Error 10004: Token expired');
      console.error('- Error 10005: IP not whitelisted');
      throw new Error(errorMsg);
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
 * Query extension status (call status)
 */
export async function fetchExtensionStatus(
  extensionIds?: string[]
): Promise<ExtensionStatus[]> {
  let endpoint = 'extension/query_call?page_size=1000';
  if (extensionIds && extensionIds.length > 0) {
    endpoint += `&ext_id_list=${extensionIds.join(',')}`;
  }

  const result = await apiRequest<any>(endpoint);

  if (result && result.errcode === 0 && result.data) {
    // Map API response to our ExtensionStatus interface
    return result.data.map((ext: any) => ({
      ext_id: ext.id || ext.ext_id,
      ext_num: ext.number || ext.ext_num,
      status: mapCallStatusToStatus(ext.call_status || ext.status),
      call_status: ext.call_status,
    }));
  }
  return [];
}

function mapCallStatusToStatus(callStatus: string): 'idle' | 'ringing' | 'busy' | 'unavailable' {
  switch (callStatus?.toLowerCase()) {
    case 'idle':
      return 'idle';
    case 'ringing':
      return 'ringing';
    case 'talking':
    case 'busy':
      return 'busy';
    default:
      return 'unavailable';
  }
}

/**
 * Query queue status
 */
export async function fetchQueueStatus(
  queueId?: string
): Promise<QueueStatus[]> {
  let endpoint = 'queue/query';
  if (queueId) {
    endpoint += `?queue_id=${queueId}`;
  }

  const result = await apiRequest<any>(endpoint);

  if (result && result.errcode === 0) {
    const queues = result.data || [];
    return queues.map((q: any) => ({
      queue_id: q.id || q.queue_id,
      queue_name: q.name || q.queue_name,
      waiting_count: q.waiting_count || 0,
      active_count: q.active_count || 0,
      agents: (q.agents || []).map((agent: any) => ({
        agent_id: agent.id || agent.agent_id,
        agent_num: agent.number || agent.agent_num,
        agent_name: agent.name || agent.agent_name,
        status: agent.status || 'unavailable',
        paused: agent.paused || false,
      })),
    }));
  }
  return [];
}

/**
 * Query active calls
 */
export async function fetchActiveCalls(): Promise<ActiveCall[]> {
  const result = await apiRequest<any>('call/query?page_size=1000');

  if (result && result.errcode === 0 && result.data) {
    return result.data.map((call: any) => ({
      call_id: call.id || call.call_id,
      channel_id: call.channel_id || call.channelid,
      call_from: call.from || call.call_from,
      call_to: call.to || call.call_to,
      status: call.status || 'talking',
      duration: call.duration || 0,
      call_type: call.call_type || call.type || 'Internal',
    }));
  }
  return [];
}

/**
 * Hangup a call
 */
export async function hangupCall(channelId: string): Promise<boolean> {
  const result = await apiRequest('call/hangup', 'POST', {
    channelid: channelId,
  });
  return result?.errcode === 0;
}

/**
 * Transfer a call (blind transfer)
 */
export async function transferCall(
  channelId: string,
  destination: string
): Promise<boolean> {
  const result = await apiRequest('call/transfer', 'POST', {
    channelid: channelId,
    destination: destination,
  });
  return result?.errcode === 0;
}

/**
 * Park a call
 */
export async function parkCall(
  channelId: string,
  parkingLot?: string
): Promise<boolean> {
  const result = await apiRequest('call/park', 'POST', {
    channelid: channelId,
    parking_lot: parkingLot,
  });
  return result?.errcode === 0;
}

/**
 * Monitor a call (listen, whisper, barge-in)
 */
export async function monitorCall(
  extensionNum: string,
  targetChannelId: string,
  mode: 'listen' | 'whisper' | 'barge'
): Promise<boolean> {
  const result = await apiRequest(`extension/${mode}`, 'POST', {
    ext_num: extensionNum,
    channelid: targetChannelId,
  });
  return result?.errcode === 0;
}

/**
 * Clear API cache
 */
export function clearApiCache(): void {
  apiCache.clear();
}
