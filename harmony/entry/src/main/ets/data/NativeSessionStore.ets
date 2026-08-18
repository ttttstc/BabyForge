import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { http } from '@kit.NetworkKit';
import { NativeResourceEnvelope, parseNativeResource } from './NativeResourceContract';

const SESSION_COOKIE_KEY: string = 'sessionCookie';
const RESOURCE_CACHE_KEY: string = 'resourceCache';

export class NativeSessionStore {
  private readonly context: common.UIAbilityContext;
  private store: preferences.Preferences | null = null;
  private cookieHeader: string = '';

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async open(): Promise<void> {
    this.store = await preferences.getPreferences(this.context, 'babyforge-native-session');
    const saved = await this.store.get(SESSION_COOKIE_KEY, '');
    this.cookieHeader = typeof saved === 'string' ? saved : '';
  }

  cookie(): string {
    return this.cookieHeader;
  }

  async capture(response: http.HttpResponse): Promise<void> {
    const rawCookies: string = String(response.cookies || '');
    const cookie = rawCookies.split(';')[0].trim();
    if (!cookie || !cookie.includes('=')) return;
    this.cookieHeader = cookie;
    if (this.store !== null) {
      await this.store.put(SESSION_COOKIE_KEY, this.cookieHeader);
      await this.store.flush();
    }
  }

  async saveResource(resource: NativeResourceEnvelope): Promise<void> {
    if (this.store === null) return;
    await this.store.put(RESOURCE_CACHE_KEY, JSON.stringify(resource));
    await this.store.flush();
  }

  async readResource(): Promise<NativeResourceEnvelope | null> {
    if (this.store === null) return null;
    const saved = await this.store.get(RESOURCE_CACHE_KEY, '');
    if (typeof saved !== 'string' || saved.length === 0) return null;
    try {
      return parseNativeResource(JSON.parse(saved) as Object);
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    this.cookieHeader = '';
    if (this.store === null) return;
    await this.store.delete(SESSION_COOKIE_KEY);
    await this.store.delete(RESOURCE_CACHE_KEY);
    await this.store.flush();
  }
}

