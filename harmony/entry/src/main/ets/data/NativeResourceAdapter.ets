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
import { NativeAgentAttachment, NativeAgentContext, NativeAgentHistoryMessage, NativeAgentReply, parseNativeAgentReply } from './NativeAgentContract';

const SERVICE_ORIGIN: string = 'https://babyforge.bbroot.com';
const NATIVE_AUTH_CALLBACK_URL: string = 'babyforge://auth/callback';

export interface NativeBootstrapResult {
  resource: NativeResourceEnvelope;
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
  baby?: NativeBabyInput | null;
}

interface NativeAgentRequest {
  message: string;
  babyId: string;
  history: Array<NativeAgentHistoryMessage>;
  context: NativeAgentContext | null;
  attachments: Array<NativeAgentAttachment>;
  skillId: string;
  decisionFacts: Object | null;
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
  id: string;
  version: number;
  occurredAt: string;
  kind: string;
  category: string;
  source: string;
  actor: Object;
  payload: Object;
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

  private async request(path: string, method: http.RequestMethod = http.RequestMethod.GET, body: Object | null = null, cancellable: boolean = false): Promise<Object> {
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
      readTimeout: 15000
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
        const error = record(payload)['error'];
        const errorValue: Record<string, Object> = error !== null && typeof error === 'object' ? record(error) : emptyRecord();
        throw new NativeTransportError(
          typeof errorValue['code'] === 'string' ? String(errorValue['code']) : 'SERVICE_ERROR',
          typeof errorValue['message'] === 'string' ? String(errorValue['message']) : '请求未完成，请稍后重试。',
          responseCode,
          Boolean(errorValue['retryable']) || responseCode >= 500
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

  async aiChat(message: string, babyId: string, history: Array<NativeAgentHistoryMessage>, context: NativeAgentContext | null, attachments: Array<NativeAgentAttachment>, skillId: string = ''): Promise<NativeAgentReply> {
    const payload: NativeAgentRequest = { message, babyId, history, context, attachments, skillId, decisionFacts: null };
    return parseNativeAgentReply(await this.request('/api/ai/chat', http.RequestMethod.POST, payload as Object, true));
  }

  cancelAiChat(): void {
    if (this.activeAgentRequest !== null) this.activeAgentRequest.destroy();
  }

  async aiReport(babyId: string, name: string, mimeType: string, text: string, dataUrl: string): Promise<Object> {
    const payload: NativeReportRequest = { babyId, name, mimeType, text, dataUrl, thirdPartyProcessingConsent: mimeType !== 'text/plain' };
    return this.request('/api/ai/report', http.RequestMethod.POST, payload as Object, true);
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

  async createCareEvent(command: NativeCareCommand): Promise<Object> {
    return this.request('/api/events', http.RequestMethod.POST, command as Object);
  }

  async correctCareEvent(eventId: string, version: number, replacement: NativeCareEvent): Promise<Object> {
    const payload: NativeCorrectionRequest = {
      id: replacement.id,
      version,
      occurredAt: replacement.occurredAt,
      kind: replacement.kind,
      category: replacement.category,
      source: replacement.source,
      actor: replacement.actor,
      payload: replacement.payload
    };
    return this.request(`/api/events/${encodeURIComponent(eventId)}`, http.RequestMethod.POST, payload as Object);
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
    const payload = record(await this.request('/api/auth/sign-in/social', http.RequestMethod.POST, requestBody({ provider, callbackURL: NATIVE_AUTH_CALLBACK_URL })));
    if (typeof payload['url'] !== 'string') throw new NativeTransportError('INVALID_RESPONSE', '第三方登录未返回跳转地址。');
    return String(payload['url']);
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
