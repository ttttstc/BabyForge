import { common } from '@kit.AbilityKit';
import { http } from '@kit.NetworkKit';
import {
  NativeContractError,
  NativeResourceEnvelope,
  parseNativeResource
} from './NativeResourceContract';
import { NativeSessionStore } from './NativeSessionStore';

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

export class NativeResourceAdapter {
  private readonly session: NativeSessionStore;
  private opened: boolean = false;

  constructor(context: common.UIAbilityContext) {
    this.session = new NativeSessionStore(context);
  }

  private async ensureOpened(): Promise<void> {
    if (this.opened) return;
    await this.session.open();
    this.opened = true;
  }

  private async request(path: string, method: http.RequestMethod = http.RequestMethod.GET, body: Object | null = null): Promise<Object> {
    await this.ensureOpened();
    const request = http.createHttp();
    const headers: NativeHeaders = body !== null
      ? {
        accept: 'application/json',
        'x-babyforge-timezone': 'Asia/Shanghai',
        'content-type': 'application/json'
      }
      : {
        accept: 'application/json',
        'x-babyforge-timezone': 'Asia/Shanghai'
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
      try {
        payload = JSON.parse(raw) as Object;
      } catch {
        throw new NativeTransportError('INVALID_RESPONSE', '共享业务服务返回了无效响应。', responseCode, responseCode >= 500);
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
