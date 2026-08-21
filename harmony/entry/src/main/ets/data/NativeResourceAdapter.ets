import { common } from '@kit.AbilityKit';
import { i18n } from '@kit.LocalizationKit';
import { http } from '@kit.NetworkKit';
import {
  NativeContractError,
  NativeResourceEnvelope,
  parseNativeResource
} from './NativeResourceContract';
import { NativeSessionStore } from './NativeSessionStore';
import { NativeCareCommand, NativeCareEvent, NativeTodayModel, parseNativeToday } from './NativeTodayContract';
import { NAIBA_CHAT_TIMEOUT_MS, NAIBA_REPORT_TIMEOUT_MS, NativeAgentAttachment, NativeAgentContext, NativeAgentHistoryMessage, NativeAgentReply, parseNativeAgentReply } from './NativeAgentContract';
import { NativeGrowthModel, parseNativeGrowth } from './NativeGrowthContract';
import { NativeExploreModel, parseNativeExplore } from './NativeExploreContract';
import { NativeSettingsModel, NativeSettingsPatch, parseNativeSettings } from './NativeSettingsContract';

const SERVICE_ORIGIN: string = 'https://babyforge.bbroot.com';
const NATIVE_AUTH_START_URL: string = `${SERVICE_ORIGIN}/api/native/auth/start`;

export interface NativeBootstrapResult {
  resource: NativeResourceEnvelope;
  source: 'network' | 'cache';
  stale: boolean;
}

export interface NativeSurfaceResult<T> {
  model: T;
  source: 'network' | 'cache';
  stale: boolean;
}

export interface NativeBabyInput {
  nickname: string;
  birthDate: string;
}

interface NativeHeaders {
  accept: string;
  'x-babyforge-timezone': string;
  Cookie?: string;
  'content-type'?: string;
}

interface NativeRequestBody {
  email?: string;
  password?: string;
  rememberMe?: boolean;
  name?: string;
  provider?: string;
  callbackURL?: string;
  token?: string;
  newPassword?: string;
  baby?: NativeBabyInput | null;
  event?: NativeCareEvent;
  enabled?: boolean;
}

interface NativeAgentRequest {
  message: string;
  babyId: string;
  history: Array<NativeAgentHistoryMessage>;
  context: NativeAgentContext | null;
  attachments: Array<NativeAgentAttachment>;
  skillId: string;
  healthEpisodeId: string;
}

interface NativeReportRequest {
  babyId: string;
  name: string;
  mimeType: string;
  text: string;
  dataUrl: string;
  thirdPartyProcessingConsent: boolean;
}

interface NativeDraftRequest { event: Object; draftType: string; }
interface NativeConfirmDraftRequest { confirmed: boolean; draftId: string; event: Object; }
interface NativeDiscardDraftRequest { draftId: string; status: string; }
const PATCH_METHOD: http.RequestMethod = 'PATCH' as http.RequestMethod;
export interface NativePhotoDownload {
  data: ArrayBuffer;
  contentType: string;
}

interface NativeCorrectionRequest {
  version: number;
  event: NativeCareEvent;
}

interface NativeVersionRequest {
  version: number;
}

function photoContentType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

export class NativeTransportError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(code: string, message: string, status: number = 0, retryable: boolean = false) {
    super(message);
    this.name = 'NativeTransportError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function record(value: Object): Record<string, Object> {
  return value as Record<string, Object>;
}

function emptyRecord(): Record<string, Object> {
  return JSON.parse('{}') as Record<string, Object>;
}

function requestBody(value: NativeRequestBody): Object {
  return value as Object;
}

function deviceTimezone(): string {
  try {
    const timezone = i18n.getTimeZone().getID();
    return timezone.trim().length > 0 ? timezone : 'UTC';
  } catch {
    return 'UTC';
  }
}

export class NativeResourceAdapter {
  private readonly session: NativeSessionStore;
  private readonly timezone: string = deviceTimezone();
  private opened: boolean = false;
  private activeAgentRequest: http.HttpRequest | null = null;

  constructor(context: common.UIAbilityContext) {
    this.session = new NativeSessionStore(context);
  }

  private async ensureOpened(): Promise<void> {
    if (this.opened) return;
    await this.session.open();
    this.opened = true;
  }

  private async request(path: string, method: http.RequestMethod = http.RequestMethod.GET, body: Object | null = null, cancellable: boolean = false, readTimeout: number = 15000): Promise<Object> {
    await this.ensureOpened();
    const request = http.createHttp();
    if (cancellable) this.activeAgentRequest = request;
    const headers: NativeHeaders = body !== null
      ? {
        accept: 'application/json',
        'x-babyforge-timezone': this.timezone,
        'content-type': 'application/json'
      }
      : {
        accept: 'application/json',
        'x-babyforge-timezone': this.timezone
      };
    const cookie: string = this.session.cookie();
    if (cookie.length > 0) headers.Cookie = cookie;
    const options: http.HttpRequestOptions = {
      method,
      header: headers,
      expectDataType: http.HttpDataType.STRING,
      connectTimeout: 10000,
      readTimeout
    };
    if (body !== null) {
      options.extraData = JSON.stringify(body);
    }

    try {
      const response = await request.request(`${SERVICE_ORIGIN}${path}`, options);
      await this.session.capture(response);
      const responseCode: number = Number(response.responseCode);
      const raw: string = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
      let payload: Object = emptyRecord();
      if (raw.trim().length > 0) {
        try {
          payload = JSON.parse(raw) as Object;
        } catch {
          throw new NativeTransportError('INVALID_RESPONSE', '共享业务服务返回了无效响应。', responseCode, responseCode >= 500);
        }
      }
      if (responseCode < 200 || responseCode >= 300) {
        const rawError = record(payload)['error'];
        const errorValue: Record<string, Object> = rawError !== null && typeof rawError === 'object' ? record(rawError) : emptyRecord();
        const nestedCode = errorValue['code'];
        const topLevelCode = record(payload)['code'];
        const nestedMessage = errorValue['message'];
        const topLevelMessage = typeof rawError === 'string' ? rawError : null;
        const payloadMessage = record(payload)['message'];
        const retryable = errorValue['retryable'];
        const serviceMessage = typeof nestedMessage === 'string'
          ? String(nestedMessage)
          : topLevelMessage !== null
            ? topLevelMessage
            : typeof payloadMessage === 'string' ? String(payloadMessage) : '';
        throw new NativeTransportError(
          typeof nestedCode === 'string'
            ? String(nestedCode)
            : typeof topLevelCode === 'string'
              ? String(topLevelCode)
              : responseCode === 401 ? 'AUTH_REQUIRED' : 'SERVICE_ERROR',
          serviceMessage === 'Invalid token' ? 'Google 登录会话已失效，请重新开始。' : serviceMessage || '请求未完成，请稍后重试。',
          responseCode,
          Boolean(retryable) || Boolean(record(payload)['retryable']) || responseCode >= 500
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof NativeTransportError || error instanceof NativeContractError) throw error as Error;
      throw new NativeTransportError('NETWORK_UNAVAILABLE', '无法连接共享业务服务，请检查网络后重试。', 0, true);
    } finally {
      if (this.activeAgentRequest === request) this.activeAgentRequest = null;
      request.destroy();
    }
  }

  private canUseSurfaceCache(error: Error): boolean {
    if (!(error instanceof NativeTransportError)) return false;
    if (error.status === 401 || error.status === 403) return false;
    return error.retryable;
  }

  private exploreCacheKey(babyId: string, category: string, query: string, organId: string): string {
    return [babyId, category, query.trim(), organId.trim()]
      .map((value: string) => encodeURIComponent(value))
      .join('|');
  }

  private async currentBabyId(): Promise<string> {
    const resource = await this.session.readResource();
    return resource?.household?.baby?.id || '';
  }

  private async readExploreCache(cacheKey: string): Promise<Object | null> {
    const saved = await this.session.readSurfaceCache('exploreCache');
    if (saved === null || typeof saved !== 'object' || Array.isArray(saved)) return null;
    const cache = record(saved);
    const value = cache[cacheKey];
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }

  private async saveExploreCache(cacheKey: string, model: NativeExploreModel): Promise<void> {
    const saved = await this.session.readSurfaceCache('exploreCache');
    const cache: Record<string, Object> = saved !== null && typeof saved === 'object' && !Array.isArray(saved)
      ? record(saved)
      : emptyRecord();
    cache[cacheKey] = model as Object;
    const keys = Object.keys(cache);
    if (keys.length <= 12) {
      await this.session.saveSurfaceCache('exploreCache', cache as Object);
      return;
    }
    const compact = emptyRecord();
    keys.slice(keys.length - 12).forEach((key: string) => compact[key] = cache[key]);
    await this.session.saveSurfaceCache('exploreCache', compact as Object);
  }

  async bootstrap(): Promise<NativeBootstrapResult> {
    try {
      const payload = await this.request('/api/native/bootstrap');
      const resource = parseNativeResource(payload);
      await this.session.saveResource(resource);
      return { resource, source: 'network', stale: false };
    } catch (error) {
      const transportError = error instanceof NativeTransportError ? error : null;
      if (transportError !== null && (transportError.status === 401 || transportError.status === 403)) throw error as Error;
      const cached = await this.session.readResource();
      if (cached !== null) return { resource: cached, source: 'cache', stale: true };
      throw error as Error;
    }
  }

  async today(day: string = ''): Promise<NativeTodayModel> {
    const query = /^\d{4}-\d{2}-\d{2}$/.test(day) ? `?day=${encodeURIComponent(day)}` : '';
    return parseNativeToday(await this.request(`/api/native/today${query}`));
  }

  async aiChat(message: string, babyId: string, history: Array<NativeAgentHistoryMessage>, context: NativeAgentContext | null, attachments: Array<NativeAgentAttachment>, skillId: string = '', healthEpisodeId: string = ''): Promise<NativeAgentReply> {
    const payload: NativeAgentRequest = { message, babyId, history, context, attachments, skillId, healthEpisodeId };
    return parseNativeAgentReply(await this.request('/api/ai/chat', http.RequestMethod.POST, payload as Object, true, NAIBA_CHAT_TIMEOUT_MS));
  }

  cancelAiChat(): void {
    if (this.activeAgentRequest !== null) this.activeAgentRequest.destroy();
  }

  async aiReport(babyId: string, name: string, mimeType: string, text: string, dataUrl: string): Promise<Object> {
    const payload: NativeReportRequest = { babyId, name, mimeType, text, dataUrl, thirdPartyProcessingConsent: mimeType !== 'text/plain' };
    return this.request('/api/ai/report', http.RequestMethod.POST, payload as Object, true, NAIBA_REPORT_TIMEOUT_MS);
  }

  async aiCreateDraft(event: Object, draftType: string): Promise<Object> {
    const payload: NativeDraftRequest = { event, draftType };
    return this.request('/api/ai/drafts', http.RequestMethod.POST, payload as Object);
  }

  async aiConfirmDraft(draftId: string, event: Object): Promise<Object> {
    const payload: NativeConfirmDraftRequest = { confirmed: true, draftId, event };
    return this.request('/api/ai/confirm-draft', http.RequestMethod.POST, payload as Object);
  }

  async aiDiscardDraft(draftId: string): Promise<Object> {
    const payload: NativeDiscardDraftRequest = { draftId, status: 'discarded' };
    return this.request('/api/ai/drafts', PATCH_METHOD, payload as Object);
  }

  async growth(): Promise<NativeSurfaceResult<NativeGrowthModel>> {
    try {
      const model = parseNativeGrowth(await this.request('/api/native/growth'));
      await this.session.saveSurfaceCache('growthCache', model as Object);
      return { model, source: 'network', stale: false };
    } catch (error) {
      if (!this.canUseSurfaceCache(error as Error)) throw error as Error;
      const cached = await this.session.readSurfaceCache('growthCache');
      if (cached !== null) return { model: parseNativeGrowth(cached), source: 'cache', stale: true };
      throw error as Error;
    }
  }

  async explore(category: string = 'recommended', query: string = '', organId: string = ''): Promise<NativeSurfaceResult<NativeExploreModel>> {
    const params: Array<string> = [`category=${encodeURIComponent(category)}`];
    if (query.trim().length > 0) params.push(`q=${encodeURIComponent(query)}`);
    if (organId.trim().length > 0) params.push(`organ=${encodeURIComponent(organId)}`);
    try {
      const model = parseNativeExplore(await this.request(`/api/native/explore?${params.join('&')}`));
      await this.saveExploreCache(this.exploreCacheKey(model.baby.id, category, query, organId), model);
      return { model, source: 'network', stale: false };
    } catch (error) {
      if (!this.canUseSurfaceCache(error as Error)) throw error as Error;
      const babyId = await this.currentBabyId();
      const cached = babyId.length > 0
        ? await this.readExploreCache(this.exploreCacheKey(babyId, category, query, organId))
        : null;
      if (cached !== null) return { model: parseNativeExplore(cached), source: 'cache', stale: true };
      throw error as Error;
    }
  }

  async settings(): Promise<NativeSurfaceResult<NativeSettingsModel>> {
    try {
      const model = parseNativeSettings(await this.request('/api/native/settings'));
      await this.session.saveSurfaceCache('settingsCache', model as Object);
      return { model, source: 'network', stale: false };
    } catch (error) {
      if (!this.canUseSurfaceCache(error as Error)) throw error as Error;
      const cached = await this.session.readSurfaceCache('settingsCache');
      if (cached !== null) return { model: parseNativeSettings(cached), source: 'cache', stale: true };
      throw error as Error;
    }
  }

  async updateSettings(patch: NativeSettingsPatch): Promise<NativeSettingsModel> {
    const model = parseNativeSettings(await this.request('/api/native/settings', PATCH_METHOD, patch as Object));
    await this.session.saveSurfaceCache('settingsCache', model as Object);
    return model;
  }

  async createNativeEvent(event: NativeCareEvent): Promise<Object> {
    return this.request('/api/events', http.RequestMethod.POST, requestBody({ event }));
  }

  async updateEmailSubscription(enabled: boolean): Promise<Object> {
    return this.request('/api/email-subscription', http.RequestMethod.PUT, requestBody({ enabled }));
  }

  async addEmailContact(email: string): Promise<Object> {
    return this.request('/api/email-subscription/contacts', http.RequestMethod.POST, requestBody({ email }));
  }

  async removeEmailContact(id: string): Promise<Object> {
    return this.request(`/api/email-subscription/contacts/${encodeURIComponent(id)}`, http.RequestMethod.DELETE);
  }

  async createVisitorLink(): Promise<Object> {
    const payload = record(await this.request('/api/visitor-links', http.RequestMethod.POST));
    const link = payload['link'];
    if (link !== null && link !== undefined && typeof link === 'object' && !Array.isArray(link)) {
      const linkRecord = record(link);
      if (typeof linkRecord['url'] === 'string' && String(linkRecord['url']).startsWith('/')) {
        linkRecord['url'] = `${SERVICE_ORIGIN}${String(linkRecord['url'])}`;
      }
    }
    return payload as Object;
  }

  async revokeVisitorLink(id: string): Promise<Object> {
    return this.request(`/api/visitor-links/${encodeURIComponent(id)}`, http.RequestMethod.DELETE);
  }

  async updateLlmConfig(input: Record<string, Object>): Promise<Object> {
    return this.request('/api/ai/config', http.RequestMethod.PUT, input as Object);
  }

  async clearLlmConfig(): Promise<Object> {
    return this.request('/api/ai/config', http.RequestMethod.DELETE);
  }

  async clearLocalCache(): Promise<void> {
    await this.ensureOpened();
    await this.session.clearLocalCache();
  }

  async createCareEvent(command: NativeCareCommand): Promise<Object> {
    return this.request('/api/events', http.RequestMethod.POST, command as Object);
  }

  async correctCareEvent(eventId: string, version: number, replacement: NativeCareEvent): Promise<Object> {
    const payload: NativeCorrectionRequest = {
      version,
      event: replacement
    };
    return this.request(`/api/events/${encodeURIComponent(eventId)}`, PATCH_METHOD, payload as Object);
  }

  async findCareEvent(babyId: string, eventId: string): Promise<Object | null> {
    const payload = record(await this.request(`/api/events?babyId=${encodeURIComponent(babyId)}&includeVoided=true`));
    const events = payload['events'];
    if (!Array.isArray(events)) return null;
    return (events as Array<Object>).find((value: Object) => record(value)['id'] === eventId) || null;
  }

  async voidCareEvent(eventId: string, version: number): Promise<Object> {
    const payload: NativeVersionRequest = { version };
    return this.request(`/api/events/${encodeURIComponent(eventId)}`, http.RequestMethod.DELETE, payload as Object);
  }

  async deletePhoto(photoId: string): Promise<Object> {
    return this.request(`/api/photos/${encodeURIComponent(photoId)}`, http.RequestMethod.DELETE);
  }

  async uploadPhoto(uri: string, babyId: string, takenAt: string, timeSource: string): Promise<Object> {
    await this.ensureOpened();
    const request = http.createHttp();
    const contentType = photoContentType(uri);
    const extension = contentType.split('/')[1].replace('jpeg', 'jpg');
    const parts: Array<http.MultiFormData> = [
      { name: 'babyId', contentType: 'text/plain', data: babyId },
      { name: 'takenAt', contentType: 'text/plain', data: takenAt },
      { name: 'timeSource', contentType: 'text/plain', data: timeSource },
      { name: 'photo', contentType, remoteFileName: `native-${Date.now()}.${extension}`, filePath: uri }
    ];
    const headers: NativeHeaders = { accept: 'application/json', 'x-babyforge-timezone': this.timezone };
    const cookie = this.session.cookie();
    if (cookie.length > 0) headers.Cookie = cookie;
    try {
      const response = await request.request(`${SERVICE_ORIGIN}/api/photos`, {
        method: http.RequestMethod.POST,
        header: headers,
        multiFormDataList: parts,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 15000,
        readTimeout: 30000
      });
      await this.session.capture(response);
      const code = Number(response.responseCode);
      const raw = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
      const payload = raw.trim().length > 0 ? JSON.parse(raw) as Object : emptyRecord();
      if (code < 200 || code >= 300) {
        const error = record(payload)['error'];
        throw new NativeTransportError('PHOTO_UPLOAD_FAILED', typeof error === 'string' ? error : '照片上传未完成。', code, code >= 500);
      }
      return payload;
    } catch (error) {
      if (error instanceof NativeTransportError) throw error;
      throw new NativeTransportError('PHOTO_UPLOAD_FAILED', '照片上传未完成，请检查网络后重试。', 0, true);
    } finally {
      request.destroy();
    }
  }

  private async fetchPhoto(photoId: string, download: boolean): Promise<NativePhotoDownload> {
    await this.ensureOpened();
    const request = http.createHttp();
    const headers: NativeHeaders = { accept: 'image/*', 'x-babyforge-timezone': this.timezone };
    const cookie = this.session.cookie();
    if (cookie.length > 0) headers.Cookie = cookie;
    try {
      const response = await request.request(`${SERVICE_ORIGIN}/api/photos/${encodeURIComponent(photoId)}${download ? '?download=1' : ''}`, {
        method: http.RequestMethod.GET,
        header: headers,
        expectDataType: http.HttpDataType.ARRAY_BUFFER,
        connectTimeout: 15000,
        readTimeout: 30000,
        maxLimit: 13 * 1024 * 1024
      });
      await this.session.capture(response);
      const code = Number(response.responseCode);
      if (code < 200 || code >= 300 || !(response.result instanceof ArrayBuffer)) throw new NativeTransportError('PHOTO_DOWNLOAD_FAILED', '照片下载未完成。', code, code >= 500);
      const responseHeaders = response.header as Record<string, Object>;
      return { data: response.result, contentType: String(responseHeaders['content-type'] || 'image/jpeg') };
    } catch (error) {
      if (error instanceof NativeTransportError) throw error;
      throw new NativeTransportError('PHOTO_DOWNLOAD_FAILED', '照片下载未完成，请检查网络后重试。', 0, true);
    } finally {
      request.destroy();
    }
  }

  async viewPhoto(photoId: string): Promise<NativePhotoDownload> {
    return this.fetchPhoto(photoId, false);
  }

  async downloadPhoto(photoId: string): Promise<NativePhotoDownload> {
    return this.fetchPhoto(photoId, true);
  }

  async saveRecordDraft(draft: Object | null): Promise<void> {
    await this.ensureOpened();
    await this.session.saveRecordDraft(draft);
  }

  async readRecordDraft(): Promise<Object | null> {
    await this.ensureOpened();
    return this.session.readRecordDraft();
  }

  async signInEmail(email: string, password: string): Promise<NativeBootstrapResult> {
    await this.request('/api/auth/sign-in/email', http.RequestMethod.POST, requestBody({ email, password, rememberMe: true }));
    return this.bootstrap();
  }

  async register(email: string, password: string): Promise<Object> {
    return this.request('/api/auth/sign-up/email', http.RequestMethod.POST, requestBody({ email, name: '家长', password }));
  }

  async resendVerification(email: string): Promise<Object> {
    return this.request('/api/auth/send-verification-email', http.RequestMethod.POST, requestBody({ email }));
  }

  async requestPasswordReset(email: string): Promise<Object> {
    return this.request('/api/auth/request-password-reset', http.RequestMethod.POST, requestBody({ email }));
  }

  async startSocialLogin(provider: string = 'google'): Promise<string> {
    if (provider !== 'google') throw new NativeTransportError('UNSUPPORTED_PROVIDER', '暂不支持该第三方登录方式。');
    return NATIVE_AUTH_START_URL;
  }

  async finishSocialLogin(token: string): Promise<NativeBootstrapResult> {
    await this.request('/api/auth/one-time-token/verify', http.RequestMethod.POST, requestBody({ token }));
    return this.bootstrap();
  }

  async setAccountPassword(newPassword: string): Promise<NativeBootstrapResult> {
    await this.request('/api/me/password', http.RequestMethod.POST, requestBody({ newPassword }));
    return this.bootstrap();
  }

  async createHousehold(name: string, baby: NativeBabyInput | null): Promise<NativeBootstrapResult> {
    await this.request('/api/household', http.RequestMethod.POST, requestBody({ name, baby }));
    return this.bootstrap();
  }

  async previewInvite(token: string): Promise<Object> {
    return this.request(`/api/household/invites/${encodeURIComponent(token)}/accept`);
  }

  async acceptInvite(token: string): Promise<NativeBootstrapResult> {
    await this.request(`/api/household/invites/${encodeURIComponent(token)}/accept`, http.RequestMethod.POST);
    return this.bootstrap();
  }

  async createInvite(): Promise<Object> {
    return this.request('/api/household/invites', http.RequestMethod.POST);
  }

  async removeMember(userId: string): Promise<NativeBootstrapResult> {
    await this.request(`/api/household/members/${encodeURIComponent(userId)}`, http.RequestMethod.DELETE);
    return this.bootstrap();
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/logout', http.RequestMethod.POST);
    } finally {
      await this.session.clear();
    }
  }
}
