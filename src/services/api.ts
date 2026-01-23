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
  YeastarContact,
  YeastarPhonebook,
  CompanyContactsApiResponse,
  PhonebooksApiResponse,
  DialCallApiResponse,
} from '@/types';

export class ApiError extends Error {
  errcode: number;
  endpoint: string;
  status: number;

  constructor(errcode: number, errmsg: string, endpoint: string, status: number) {
    super(`API Error ${errcode} (${endpoint}): ${errmsg}`);
    this.name = 'ApiError';
    this.errcode = errcode;
    this.endpoint = endpoint;
    this.status = status;
  }
}

function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('access_token');
    return urlObj.toString();
  } catch {
    return url;
  }
}

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

const CALL_QUERY_TYPES = ['inbound', 'outbound', 'internal'] as const;
type CallQueryType = (typeof CALL_QUERY_TYPES)[number];

function mapMemberStatusToExtensionState(
  status?: string
): 'ringing' | 'busy' | null {
  const normalized = status?.toLowerCase() || '';
  if (normalized.includes('ring') || normalized.includes('alert')) return 'ringing';
  if (normalized.includes('answer') || normalized.includes('talk') || normalized.includes('hold')) {
    return 'busy';
  }
  return null;
}

function mapMemberStatusToCallState(
  status?: string
): 'ringing' | 'talking' | 'hold' | null {
  const normalized = status?.toLowerCase() || '';
  if (normalized.includes('hold')) return 'hold';
  if (normalized.includes('ring') || normalized.includes('alert')) return 'ringing';
  if (normalized.includes('answer') || normalized.includes('talk')) return 'talking';
  return null;
}

function isExtensionOnline(onlineStatus?: Record<string, { status?: number }>): boolean {
  if (!onlineStatus || typeof onlineStatus !== 'object') return true;
  return Object.values(onlineStatus).some((device) => device?.status === 1);
}

function normalizeNumber(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function mapCallType(type: CallQueryType): ActiveCall['call_type'] {
  switch (type) {
    case 'inbound':
      return 'Inbound';
    case 'outbound':
      return 'Outbound';
    default:
      return 'Internal';
  }
}

function mapPresenceStatus(status?: number): string {
  switch (status) {
    case 0:
      return 'Available';
    case 1:
      return 'Do Not Disturb';
    case 2:
      return 'Away';
    case 3:
      return 'Busy';
    case 4:
      return 'Out to Lunch';
    case 5:
      return 'Be Right Back';
    default:
      return status === undefined ? 'Unknown' : `Status ${status}`;
  }
}

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
  // Remove protocol from pbxHost since proxy will add https://
  const cleanHost = pbxHost.replace(/^https?:\/\//, '');

  const targetUrl = `${cleanHost}/openapi/v1.0/${endpoint.split('?')[0]}`;
  const params = new URLSearchParams(endpoint.split('?')[1] || '');
  if (accessToken) {
    params.append('access_token', accessToken);
  }

  const finalUrl = `${proxyUrl}/api/proxy/${targetUrl}?${params.toString()}`;
  const safeUrl = sanitizeUrl(finalUrl);

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
        `PBX returned non-JSON response for ${endpoint}. Check proxy configuration.`
      );
    }

    if (!responseData) {
      throw new Error('PBX returned empty data for ' + endpoint);
    }

    // Token expired
    if (responseData.errcode === 10004 && !isRetry) {
      console.log('Token expired, need to re-authenticate');
      clearAccessToken();
      throw new Error(`Authentication expired while calling ${endpoint}. Please reconnect.`);
    }

    if (!response.ok || (responseData.errcode && responseData.errcode !== 0)) {
      console.error('API request failed', {
        endpoint,
        status: response.status,
        errcode: responseData.errcode,
        errmsg: responseData.errmsg,
        url: safeUrl,
        method,
      });
      throw new ApiError(
        responseData.errcode ?? response.status,
        responseData.errmsg || 'Unknown error',
        endpoint,
        response.status
      );
    }

    return responseData;
  } catch (error) {
    console.error(`Error in apiRequest for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Test proxy connection
 */
export async function testProxyConnection(proxyUrl: string): Promise<boolean> {
  try {
    console.log('Testing proxy connection to:', proxyUrl);

    const testUrl = `${proxyUrl}/api/health`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Proxy health check status:', response.status);

    if (response.ok) {
      console.log('✅ Proxy is accessible');
      return true;
    } else {
      console.warn('⚠️ Proxy responded but returned status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Cannot reach proxy:', error);
    return false;
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
  // Remove protocol from host since proxy will add https://
  const cleanHost = host.replace(/^https?:\/\//, '');

  const targetUrl = `${cleanHost}/openapi/v1.0/get_token`;
  const url = `${proxyUrlParam}/api/proxy/${targetUrl}`;

  console.log('Authentication request URL:', url);
  console.log('Target PBX host:', cleanHost);
  console.log('Request payload:', {
    username: clientId,
    password: '***hidden***'
  });

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
  } catch (error: any) {
    console.error('Error getting access token:', error);

    // Provide more specific error messages
    if (error.message && error.message.includes('Failed to fetch')) {
      throw new Error(
        'Cannot connect to proxy server. Please check:\n' +
        '1. Proxy URL is correct and accessible\n' +
        '2. Proxy server is running\n' +
        '3. CORS is enabled on proxy\n' +
        '4. No browser extensions blocking requests\n' +
        `Proxy URL: ${proxyUrlParam}`
      );
    } else if (error.name === 'TypeError') {
      throw new Error(
        'Network error. Check your internet connection and proxy URL.\n' +
        `Attempting to connect to: ${proxyUrlParam}`
      );
    }

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

  const result = await apiRequest<any>('extension/list?page_size=1000');
  if (result && result.errcode === 0) {
    const extensions = ((result as any).extension_list || result.data || []) as any[];
    const mapped = extensions.map((ext) => ({
      id: normalizeNumber(ext.id || ext.ext_id || ext.extension_id),
      number: normalizeNumber(ext.number || ext.ext_num),
      display_name: ext.caller_id_name || ext.display_name || ext.username,
      username: ext.username || ext.user_name,
      online_status: ext.online_status,
      presence_status: ext.presence_status,
    })) as Extension[];
    apiCache.set(cacheKey, mapped);
    return mapped;
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
    const queues = ((result as any).queue_list || result.data || []) as any[];
    const mapped = queues.map((queue) => ({
      id: normalizeNumber(queue.id || queue.queue_id),
      name: queue.name || queue.queue_name,
    })) as Queue[];
    apiCache.set(cacheKey, mapped);
    return mapped;
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
 * Fetch call statistics by communication type (Inbound/Outbound)
 * This provides more accurate data matching Yeastar's Extension Call Statistics Report
 */
export async function fetchCallStatsByType(
  extensionIds: string[],
  startTime: string,
  endTime: string,
  communicationType: 'Inbound' | 'Outbound'
): Promise<CallStats[]> {
  if (extensionIds.length === 0) return [];

  const endpoint = `call_report/list?type=extcallstatistics&start_time=${encodeURIComponent(
    startTime
  )}&end_time=${encodeURIComponent(endTime)}&ext_id_list=${extensionIds.join(',')}&communication_type=${communicationType}`;

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
  const baseEndpoint = `cdr/list?page_size=${pageSize}&sort_by=time&order_by=desc&page=${page}`;
  const hasFilters =
    !!filters &&
    (Boolean(filters.startTime) ||
      Boolean(filters.endTime) ||
      Boolean(filters.extNum) ||
      Boolean(filters.disposition));

  let result: ApiResponse<CallRecord[]> | null = null;

  if (hasFilters && filters) {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('page_size', String(pageSize));
    if (filters.startTime) params.append('start_time', filters.startTime);
    if (filters.endTime) params.append('end_time', filters.endTime);
    if (filters.disposition) params.append('status', filters.disposition);
    if (filters.extNum) params.append('call_from', filters.extNum);

    const endpoint = `cdr/search?${params.toString()}`;

    try {
      result = await apiRequest<CallRecord[]>(endpoint);
    } catch (error: any) {
      if (error instanceof ApiError && error.errcode === 40002) {
        console.warn('CDR search parameters rejected by PBX, retrying without filters');
        result = await apiRequest<CallRecord[]>(baseEndpoint);
      } else {
        throw error;
      }
    }
  } else {
    result = await apiRequest<CallRecord[]>(baseEndpoint);
  }

  if (result && result.errcode === 0 && result.data) {
    const totalNumber = (result as any).total_number;
    const hasMore =
      typeof totalNumber === 'number'
        ? page * pageSize < totalNumber
        : result.data.length >= pageSize;

    return {
      data: result.data,
      hasMore,
    };
  }

  return { data: [], hasMore: false };
}

/**
 * Fetch all CDR records for an extension within a date range
 * Used for detailed call reports
 */
export async function fetchExtensionCDR(
  extNum: string,
  startTime: string,
  endTime: string,
  pageSize: number = 10000
): Promise<CallRecord[]> {
  const allRecords: CallRecord[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('page_size', String(pageSize));
    params.append('start_time', startTime);
    params.append('end_time', endTime);
    params.append('sort_by', 'time');
    params.append('order_by', 'desc');

    // Try searching CDR - we'll filter by extension in JS since API filtering can be inconsistent
    const endpoint = `cdr/search?${params.toString()}`;

    try {
      const result = await apiRequest<CallRecord[]>(endpoint);

      if (result && result.errcode === 0 && result.data) {
        // Filter records where the extension is either the caller or callee
        const filtered = result.data.filter((record) => {
          const from = String(record.call_from || '').trim();
          const to = String(record.call_to || '').trim();
          return from === extNum || to === extNum;
        });

        allRecords.push(...filtered);

        const totalNumber = (result as any).total_number;
        hasMore =
          typeof totalNumber === 'number'
            ? page * pageSize < totalNumber
            : result.data.length >= pageSize;
        page++;
      } else {
        hasMore = false;
      }
    } catch (error: any) {
      console.error('Error fetching extension CDR:', error);
      // If search fails, try basic list endpoint
      if (page === 1) {
        try {
          const basicEndpoint = `cdr/list?page_size=${pageSize}&sort_by=time&order_by=desc`;
          const basicResult = await apiRequest<CallRecord[]>(basicEndpoint);
          if (basicResult && basicResult.errcode === 0 && basicResult.data) {
            const filtered = basicResult.data.filter((record) => {
              const from = String(record.call_from || '').trim();
              const to = String(record.call_to || '').trim();
              return from === extNum || to === extNum;
            });
            allRecords.push(...filtered);
          }
        } catch (fallbackError) {
          console.error('Fallback CDR fetch also failed:', fallbackError);
        }
      }
      hasMore = false;
    }
  }

  return allRecords;
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

async function queryCallsByType(type: CallQueryType): Promise<any[]> {
  try {
    const result = await apiRequest<any>(`call/query?type=${type}`);
    if (result && result.errcode === 0 && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  } catch (error: any) {
    if (error instanceof ApiError && error.errcode === 10001) {
      console.warn(`call/query not supported for type "${type}" on this PBX`);
      return [];
    }
    throw error;
  }
}

/**
 * Query extension status (call status)
 */
export async function fetchExtensionStatus(
  extensionIds?: string[]
): Promise<ExtensionStatus[]> {
  const extensions = await fetchExtensions(true);
  const filteredExtensions =
    extensionIds && extensionIds.length > 0
      ? extensions.filter((ext) => extensionIds.includes(ext.id))
      : extensions;

  const extensionStatusMap = new Map<string, 'ringing' | 'busy'>();

  try {
    const callResults = await Promise.all(
      CALL_QUERY_TYPES.map(async (type) => ({
        type,
        data: await queryCallsByType(type),
      }))
    );

    for (const callResult of callResults) {
      for (const call of callResult.data) {
        const members = Array.isArray(call.members) ? call.members : [];
        for (const member of members) {
          const data = member?.extension || member?.inbound || member?.outbound;
          if (!data) continue;
          const extNum = normalizeNumber(data.number || data.ext_num);
          if (!extNum) continue;
          const status = mapMemberStatusToExtensionState(data.member_status);
          if (!status) continue;

          const current = extensionStatusMap.get(extNum);
          if (current === 'busy') continue;
          if (current === 'ringing' && status === 'ringing') continue;
          extensionStatusMap.set(extNum, status);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to query call status for extensions:', error);
  }

  return filteredExtensions.map((ext) => {
    const extNum = normalizeNumber(ext.number || (ext as any).ext_num);
    const online = isExtensionOnline((ext as any).online_status);
    const callStatus = extensionStatusMap.get(extNum);
    const presenceStatus =
      (ext as any).presence_status?.status ??
      (ext as any).presence_status ??
      (ext as any).presence;
    const presenceLabel = mapPresenceStatus(
      typeof presenceStatus === 'number' ? presenceStatus : undefined
    );

    let status: ExtensionStatus['status'] = 'idle';
    if (!online) {
      status = 'unavailable';
    } else if (callStatus === 'busy') {
      status = 'busy';
    } else if (callStatus === 'ringing') {
      status = 'ringing';
    }

    return {
      ext_id: ext.id,
      ext_num: extNum,
      ext_name: (ext as any).ext_name,
      display_name: ext.display_name || (ext as any).caller_id_name || ext.username,
      status,
      call_status: status === 'busy' ? 'talking' : status === 'ringing' ? 'ringing' : 'idle',
      presence_status: typeof presenceStatus === 'number' ? presenceStatus : undefined,
      presence_label: presenceLabel,
    };
  });
}

/**
 * Query queue status
 */
export async function fetchQueueStatus(
  queueId?: string
): Promise<QueueStatus[]> {
  const queues = await fetchQueues(true);
  const targetQueues = queueId
    ? queues.filter((queue) => queue.id === queueId)
    : queues;

  if (targetQueues.length === 0) return [];

  const statuses = await Promise.all(
    targetQueues.map(async (queue) => {
      const [callStatusResult, agentStatusResult] = await Promise.all([
        apiRequest<any>(`queue/call_status?id=${queue.id}`),
        apiRequest<any>(`queue/agent_status?id=${queue.id}`),
      ]);

      const callStatus = callStatusResult?.data || {};
      const agentStatusList = agentStatusResult?.data || [];

      const waitingCount =
        callStatus.waiting_calls ?? callStatus.waiting_count ?? callStatus.waiting_list?.length ?? 0;
      const activeCount =
        (callStatus.active_calls ?? callStatus.active_count ?? callStatus.active_list?.length ?? 0) +
        (callStatus.ringing_calls ?? callStatus.ringing_count ?? callStatus.ringing_list?.length ?? 0);

      const agents = (agentStatusList || []).map((agent: any) => {
        const callStatusValue = Number.parseInt(agent.call_status, 10);
        let status: QueueStatus['agents'][number]['status'] = 'unavailable';

        switch (callStatusValue) {
          case 1:
            status = 'idle';
            break;
          case 2:
          case 4:
          case 5:
            status = 'busy';
            break;
          case 3:
            status = 'ringing';
            break;
          default:
            status = 'unavailable';
        }

        return {
          agent_id: normalizeNumber(agent.number || agent.agent_id || agent.id),
          agent_num: normalizeNumber(agent.number || agent.agent_num),
          agent_name: agent.name || agent.agent_name,
          status,
          paused: agent.is_pause === 1 || agent.paused === true,
        };
      });

      return {
        queue_id: queue.id,
        queue_name: queue.name,
        waiting_count: waitingCount,
        active_count: activeCount,
        agents,
      };
    })
  );

  return statuses;
}

/**
 * Query active calls
 */
export async function fetchActiveCalls(): Promise<ActiveCall[]> {
  const results = await Promise.all(
    CALL_QUERY_TYPES.map(async (type) => ({
      type,
      data: await queryCallsByType(type),
    }))
  );

  const calls: ActiveCall[] = [];

  for (const result of results) {
    const callType = mapCallType(result.type);
    for (const call of result.data) {
      const members = Array.isArray(call.members) ? call.members : [];
      let callFrom = '';
      let callTo = '';
      let channelId = '';
      let status: ActiveCall['status'] = 'talking';
      let statusPriority = 0;

      for (const member of members) {
        const data = member?.extension || member?.inbound || member?.outbound;
        if (!data) continue;

        if (member?.inbound || member?.outbound) {
          callFrom = data.from || callFrom;
          callTo = data.to || callTo;
        }

        if (!channelId) {
          channelId = data.channel_id || data.channelid || channelId;
        }

        const memberStatus = mapMemberStatusToCallState(data.member_status);
        if (!memberStatus) continue;

        const priority = memberStatus === 'hold' ? 3 : memberStatus === 'ringing' ? 2 : 1;
        if (priority > statusPriority) {
          statusPriority = priority;
          status = memberStatus;
        }
      }

      if (!callFrom && members.length > 0) {
        const fallback = members[0].extension || members[0].inbound || members[0].outbound;
        callFrom = fallback?.number || fallback?.from || '';
        callTo = fallback?.to || '';
      }

      const callId = normalizeNumber(call.id || call.call_id);
      calls.push({
        call_id: callId || `${callType}-${channelId || callFrom}-${callTo}`,
        channel_id: channelId,
        call_from: callFrom,
        call_to: callTo,
        status,
        duration: 0,
        call_type: callType,
      });
    }
  }

  return calls;
}

/**
 * Hangup a call
 */
export async function hangupCall(channelId: string): Promise<boolean> {
  const result = await apiRequest('call/hangup', 'POST', {
    channel_id: channelId,
  });
  return result?.errcode === 0;
}

/**
 * Transfer a call (blind transfer)
 */
export async function transferCall(
  channelId: string,
  destination: string,
  transferorExtension: string
): Promise<boolean> {
  const result = await apiRequest('call/transfer', 'POST', {
    type: 'blind',
    channel_id: channelId,
    number: destination,
    dial_permission: transferorExtension,
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
    channel_id: channelId,
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
  const listenType = mode === 'listen' ? 1 : mode === 'whisper' ? 2 : 3;
  const result = await apiRequest('call/listen', 'POST', {
    extension: extensionNum,
    channel_id: targetChannelId,
    listen_type: listenType,
  });
  return result?.errcode === 0;
}

/**
 * Clear API cache
 */
export function clearApiCache(): void {
  apiCache.clear();
}

// ============================================
// CMS API Functions
// ============================================

/**
 * Fetch all company contacts from Yeastar
 */
export async function fetchCompanyContacts(
  page: number = 1,
  pageSize: number = 10000
): Promise<{ data: YeastarContact[]; totalNumber: number; hasMore: boolean }> {
  const endpoint = `company_contact/list?page=${page}&page_size=${pageSize}`;
  const result = await apiRequest<YeastarContact[]>(endpoint) as CompanyContactsApiResponse;

  if (result && result.errcode === 0 && result.data) {
    const totalNumber = result.total_number || result.data.length;
    return {
      data: result.data,
      totalNumber,
      hasMore: page * pageSize < totalNumber,
    };
  }

  return { data: [], totalNumber: 0, hasMore: false };
}

/**
 * Search company contacts
 */
export async function searchCompanyContacts(
  query: string,
  page: number = 1,
  pageSize: number = 100
): Promise<{ data: YeastarContact[]; totalNumber: number }> {
  const endpoint = `company_contact/search?keyword=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`;
  const result = await apiRequest<YeastarContact[]>(endpoint) as CompanyContactsApiResponse;

  if (result && result.errcode === 0 && result.data) {
    return {
      data: result.data,
      totalNumber: result.total_number || result.data.length,
    };
  }

  return { data: [], totalNumber: 0 };
}

/**
 * Get a specific company contact by ID
 */
export async function getCompanyContact(id: number): Promise<YeastarContact | null> {
  const result = await apiRequest<YeastarContact>(`company_contact/get?id=${id}`);

  if (result && result.errcode === 0 && result.data) {
    return result.data;
  }

  return null;
}

// Type for Yeastar contact write operations (create/update)
interface YeastarContactWriteData {
  first_name: string;
  last_name?: string;
  company?: string;
  email?: string;
  remark?: string;
  number_list: Array<{ num_type: string; number: string }>;
}

/**
 * Create a new company contact in Yeastar
 */
export async function createCompanyContact(
  contact: YeastarContactWriteData
): Promise<{ success: boolean; id?: number }> {
  const result = await apiRequest<{ id: number }>('company_contact/create', 'POST', contact);

  if (result && result.errcode === 0) {
    return { success: true, id: result.data?.id };
  }

  return { success: false };
}

/**
 * Update an existing company contact in Yeastar
 */
export async function updateCompanyContact(
  id: number,
  contact: YeastarContactWriteData
): Promise<boolean> {
  const result = await apiRequest('company_contact/update', 'POST', { id, ...contact });
  return result?.errcode === 0;
}

/**
 * Delete a company contact from Yeastar
 */
export async function deleteCompanyContact(id: number): Promise<boolean> {
  const result = await apiRequest(`company_contact/delete?id=${id}`, 'GET');
  return result?.errcode === 0;
}

/**
 * Fetch all phonebooks from Yeastar
 */
export async function fetchPhonebooks(
  page: number = 1,
  pageSize: number = 100
): Promise<YeastarPhonebook[]> {
  const endpoint = `phonebook/list?page=${page}&page_size=${pageSize}`;
  const result = await apiRequest<YeastarPhonebook[]>(endpoint) as PhonebooksApiResponse;

  if (result && result.errcode === 0 && result.data) {
    return result.data;
  }

  return [];
}

/**
 * Make a call (Click2Call)
 * @param caller - Extension number that will make the call
 * @param callee - Destination number to call
 * @param options - Optional settings
 */
export async function dialCall(
  caller: string,
  callee: string,
  options?: {
    dialPermission?: string;
    autoAnswer?: boolean;
  }
): Promise<{ success: boolean; callId?: string }> {
  const body: Record<string, string> = {
    caller,
    callee,
  };

  if (options?.dialPermission) {
    body.dial_permission = options.dialPermission;
  }

  if (options?.autoAnswer !== undefined) {
    body.auto_answer = options.autoAnswer ? 'yes' : 'no';
  }

  const result = await apiRequest<DialCallApiResponse>('call/dial', 'POST', body);

  if (result && result.errcode === 0) {
    return {
      success: true,
      callId: (result as any).call_id || result.data?.call_id,
    };
  }

  return { success: false };
}
