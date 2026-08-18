import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { http } from '@kit.NetworkKit';
import { NativeResourceEnvelope, parseNativeResource } from './NativeResourceContract';

const SESSION_COOKIE_KEY: string = 'sessionCookie';
const RESOURCE_CACHE_KEY: string = 'resourceCache';
const RECORD_DRAFT_KEY: string = 'recordDraft';

interface ParsedCookie {
  name: string;
  value: string;
  expired: boolean;
}

const COOKIE_ATTRIBUTES: Array<string> = [
  'domain',
  'expires',
  'httponly',
  'max-age',
  'partitioned',
  'path',
  'priority',
  'samesite',
  'secure'
];

function cookieRecords(raw: string): Array<string> {
  // Set-Cookie values may be newline- or comma-delimited. Only split commas
  // that introduce another name=value pair so Expires dates remain intact.
  return raw.replace(/\r?\n/g, ',').split(/,(?=\s*[^,;=\s]+=[^,;]*)/);
}

function parseCookies(raw: string): Array<ParsedCookie> {
  const parsed: Array<ParsedCookie> = [];
  for (const record of cookieRecords(raw)) {
    const parts = record.split(';');
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index].trim();
      const separator = part.indexOf('=');
      if (separator <= 0) continue;
      const name = part.substring(0, separator).trim();
      if (COOKIE_ATTRIBUTES.includes(name.toLowerCase())) continue;
      const value = part.substring(separator + 1).trim();
      let expired = false;
      for (let attributeIndex = index + 1; attributeIndex < parts.length; attributeIndex += 1) {
        const attribute = parts[attributeIndex].trim();
        const attributeSeparator = attribute.indexOf('=');
        if (attributeSeparator <= 0) continue;
        const attributeName = attribute.substring(0, attributeSeparator).trim().toLowerCase();
        const attributeValue = attribute.substring(attributeSeparator + 1).trim();
        if (attributeName === 'max-age' && Number(attributeValue) <= 0) expired = true;
        if (attributeName === 'expires') {
          const expiresAt = Date.parse(attributeValue);
          if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) expired = true;
        }
      }
      parsed.push({ name, value, expired });
    }
  }
  return parsed;
}

function mergeCookies(existing: Array<ParsedCookie>, incoming: Array<ParsedCookie>): Array<ParsedCookie> {
  const merged: Array<ParsedCookie> = [];
  for (const cookie of existing) {
    merged.push({ name: cookie.name, value: cookie.value, expired: false });
  }
  for (const cookie of incoming) {
    const existingIndex = merged.findIndex((candidate) => candidate.name === cookie.name);
    if (cookie.expired || cookie.value.length === 0) {
      if (existingIndex >= 0) merged.splice(existingIndex, 1);
      continue;
    }
    if (existingIndex >= 0) {
      merged[existingIndex] = { name: cookie.name, value: cookie.value, expired: false };
    } else {
      merged.push({ name: cookie.name, value: cookie.value, expired: false });
    }
  }
  return merged;
}

function serializeCookies(cookies: Array<ParsedCookie>): string {
  const serialized: Array<string> = [];
  for (const cookie of cookies) serialized.push(`${cookie.name}=${cookie.value}`);
  return serialized.join('; ');
}

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
    const rawCookieSources: Array<string> = [];
    const responseCookies: string = String(response.cookies || '');
    if (responseCookies.length > 0) rawCookieSources.push(responseCookies);
    const responseHeaders = response.header as Record<string, Object>;
    for (const headerName of ['set-cookie', 'Set-Cookie']) {
      const headerValue = responseHeaders[headerName];
      if (headerValue !== undefined && headerValue !== null) rawCookieSources.push(String(headerValue));
    }
    const incoming = parseCookies(rawCookieSources.join(','));
    if (incoming.length === 0) return;
    this.cookieHeader = serializeCookies(mergeCookies(parseCookies(this.cookieHeader), incoming));
    if (this.store !== null) {
      if (this.cookieHeader.length === 0) {
        await this.store.delete(SESSION_COOKIE_KEY);
      } else {
        await this.store.put(SESSION_COOKIE_KEY, this.cookieHeader);
      }
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

  async saveRecordDraft(draft: Object | null): Promise<void> {
    if (this.store === null) return;
    if (draft === null) await this.store.delete(RECORD_DRAFT_KEY);
    else await this.store.put(RECORD_DRAFT_KEY, JSON.stringify(draft));
    await this.store.flush();
  }

  async readRecordDraft(): Promise<Object | null> {
    if (this.store === null) return null;
    const saved = await this.store.get(RECORD_DRAFT_KEY, '');
    if (typeof saved !== 'string' || saved.length === 0) return null;
    try { return JSON.parse(saved) as Object; } catch { return null; }
  }

  async clear(): Promise<void> {
    this.cookieHeader = '';
    if (this.store === null) return;
    await this.store.delete(SESSION_COOKIE_KEY);
    await this.store.delete(RESOURCE_CACHE_KEY);
    await this.store.delete(RECORD_DRAFT_KEY);
    await this.store.flush();
  }
}
