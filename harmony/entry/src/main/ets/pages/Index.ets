import { common } from '@kit.AbilityKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo, picker } from '@kit.CoreFileKit';
import { image } from '@kit.ImageKit';
import { camera, cameraPicker } from '@kit.CameraKit';
import vibrator from '@ohos.vibrator';
import {
  NativeBootstrapResult,
  NativeBabyInput,
  NativeResourceAdapter,
  NativeTransportError
} from '../data/NativeResourceAdapter';
import {
  NativeContractError,
  NativeHousehold,
  NativeMember,
  NativeResourceEnvelope
} from '../data/NativeResourceContract';
import { NativeNavigationStore, NativeTab, NATIVE_TABS } from '../navigation/NativeNavigation';
import {
  NativeCareCommand,
  NativeCareEvent,
  NativeRecordType,
  NativeTodayFact,
  NativeTodayModel,
  NativeTodayPhoto,
  NativeTodayTask,
  createNativeCareCommand
} from '../data/NativeTodayContract';

type NativePhase = 'loading' | 'login' | 'household' | 'ready' | 'error';
type LoginMode = 'login' | 'register' | 'reset';
type TodayPhase = 'loading' | 'ready' | 'error';

interface NativeRecordDraft {
  type: NativeRecordType;
  value: string;
  extra: string;
  option: string;
  commandId: string;
}

interface NativePhotoTimestamp {
  takenAt: string;
  timeSource: string;
}

function jsonRecord(value: string): Record<string, Object | null> {
  return JSON.parse(value) as Record<string, Object | null>;
}

function tabLabel(tab: NativeTab): string {
  if (tab === 'today') return '今天';
  if (tab === 'record') return '记录';
  if (tab === 'ai') return '奶爸 AI';
  if (tab === 'growth') return '成长';
  return '探索';
}

function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'readOnly') return '只读';
  return 'Member';
}

function recordLabel(type: NativeRecordType): string {
  if (type === 'feeding') return '喂养';
  if (type === 'sleep') return '睡眠';
  if (type === 'diaper') return '尿布';
  if (type === 'medication') return '用药';
  if (type === 'temperature') return '体温';
  return '成长测量';
}

function recordArt(type: NativeRecordType): Resource {
  if (type === 'feeding') return $r('app.media.record_feeding_mouth');
  if (type === 'sleep') return $r('app.media.record_sleep_eyes');
  if (type === 'diaper') return $r('app.media.record_diaper_bottom');
  if (type === 'medication') return $r('app.media.record_medication_mouth');
  if (type === 'temperature') return $r('app.media.record_temperature_forehead');
  return $r('app.media.record_growth_feet');
}

@Entry
@Component
struct Index {
  private adapter: NativeResourceAdapter | null = null;
  private readonly navigation: NativeNavigationStore = new NativeNavigationStore();
  @State private phase: NativePhase = 'loading';
  @State private loginMode: LoginMode = 'login';
  @State private resource: NativeResourceEnvelope | null = null;
  @State private activeTab: NativeTab = 'today';
  @State private selectedRoute: string = 'today.root';
  @State private statusMessage: string = '';
  @State private needsVerification: boolean = false;
  @State private staleCache: boolean = false;
  @State private showFamilyPanel: boolean = false;
  @State private largeText: boolean = false;
  @State private reducedMotion: boolean = false;
  @State private email: string = '';
  @State private password: string = '';
  @State private householdName: string = '';
  @State private babyNickname: string = '';
  @State private babyBirthDate: string = '';
  @State private inviteToken: string = '';
  @State private invitePreview: string = '';
  @State private busy: boolean = false;
  @State private todayPhase: TodayPhase = 'loading';
  @State private today: NativeTodayModel | null = null;
  @State private selectedDay: string = '';
  @State private selectedPhotoIndex: number = 0;
  @State private selectedRecordType: NativeRecordType | null = null;
  @State private recordValue: string = '';
  @State private recordExtra: string = '';
  @State private recordOption: string = '';
  @State private recordCommandId: string = '';
  @State private recordError: string = '';
  @State private feedbackMessage: string = '';
  @State private undoEventId: string = '';
  @State private undoEventVersion: number = 1;
  @State private photoMessage: string = '';
  @State private factFilter: string = 'all';
  @State private correctionEventId: string = '';
  @State private correctionEventVersion: number = 1;
  @State private showPhotoViewer: boolean = false;
  @State private photoPixel: image.PixelMap | null = null;
  @State private photoLoading: boolean = false;
  @State private photoLoadFailed: boolean = false;
  @StorageProp('topAvoidHeight') private topAvoidHeight: number = 0;
  @StorageProp('bottomAvoidHeight') private bottomAvoidHeight: number = 0;
  @StorageProp('nativeAuthCallback') private nativeAuthCallback: string = '';
  private handledNativeAuthCallback: string = '';
  private photoLoadToken: number = 0;
  private correctionOccurredAt: string = '';
  private correctionOriginalEvent: NativeCareEvent | null = null;
  private undoCorrectionOriginal: NativeCareEvent | null = null;

  aboutToAppear(): void {
    this.adapter = new NativeResourceAdapter(getContext(this) as common.UIAbilityContext);
    this.restoreRecordDraft();
    if (this.nativeAuthCallback.length === 0) this.loadResource();
    this.consumeNativeAuthCallback();
  }

  onPageShow(): void {
    this.consumeNativeAuthCallback();
  }

  aboutToDisappear(): void {
    this.photoLoadToken += 1;
    if (this.photoPixel !== null) this.photoPixel.release();
    this.photoPixel = null;
  }

  private consumeNativeAuthCallback(): void {
    if (this.nativeAuthCallback.length === 0 || this.nativeAuthCallback === this.handledNativeAuthCallback) return;
    const callback = this.nativeAuthCallback;
    this.handledNativeAuthCallback = callback;
    AppStorage.setOrCreate('nativeAuthCallback', '');
    this.statusMessage = callback.includes('error=')
      ? 'Google 登录未完成，请重试。'
      : 'Google 登录已返回，正在同步账户…';
    this.loadResource();
  }

  onBackPress(): boolean {
    if (this.showFamilyPanel) {
      this.showFamilyPanel = false;
      return true;
    }
    if (this.phase === 'ready' && this.navigation.back(this.activeTab)) {
      this.syncNavigation();
      return true;
    }
    return false;
  }

  private async loadResource(): Promise<void> {
    if (this.adapter === null) return;
    this.phase = 'loading';
    this.statusMessage = '';
    try {
      const result: NativeBootstrapResult = await this.adapter.bootstrap();
      this.applyResource(result);
    } catch (error) {
      const transport = error instanceof NativeTransportError ? error : null;
      if (transport !== null && (transport.status === 401 || transport.status === 403)) {
        this.phase = 'login';
        this.statusMessage = transport.message;
      } else {
        this.phase = 'error';
        this.statusMessage = error instanceof Error ? error.message : '共享业务服务暂时不可用，请重试。';
      }
    }
  }

  private applyResource(result: NativeBootstrapResult): void {
    this.resource = result.resource;
    this.staleCache = result.stale;
    this.phase = result.resource.household === null ? 'household' : 'ready';
    this.showFamilyPanel = false;
    this.statusMessage = result.stale ? '当前显示最近一次成功同步的内容；恢复网络后可重新读取。' : '';
    if (this.phase === 'ready') this.loadToday();
  }

  private async loadToday(day: string = this.selectedDay): Promise<void> {
    if (this.adapter === null || this.resource?.household?.baby === null) return;
    this.todayPhase = 'loading';
    try {
      const model = await this.adapter.today(day);
      this.today = model;
      this.selectedDay = model.selectedDay;
      this.selectedPhotoIndex = Math.min(this.selectedPhotoIndex, Math.max(0, model.photos.length - 1));
      this.todayPhase = 'ready';
      await this.loadPhotoPixel(this.selectedPhotoIndex);
    } catch (error) {
      this.todayPhase = 'error';
      this.statusMessage = error instanceof Error ? error.message : '今日页面模型读取失败，请重试。';
    }
  }

  private async loadPhotoPixel(index: number): Promise<void> {
    const token = ++this.photoLoadToken;
    if (this.photoPixel !== null) this.photoPixel.release();
    this.photoPixel = null;
    this.photoLoadFailed = false;
    this.photoLoading = false;
    if (this.adapter === null || this.today === null || this.today.photos.length === 0) return;
    const photo = this.today.photos[index];
    this.photoLoading = true;
    try {
      const response = await this.adapter.viewPhoto(photo.id);
      const source = image.createImageSource(response.data);
      const pixel = await source.createPixelMap();
      await source.release();
      if (token !== this.photoLoadToken) {
        pixel.release();
        return;
      }
      this.photoPixel = pixel;
    } catch {
      if (token === this.photoLoadToken) this.photoLoadFailed = true;
    } finally {
      if (token === this.photoLoadToken) this.photoLoading = false;
    }
  }

  private retryPhotos(): void {
    this.loadPhotoPixel(this.selectedPhotoIndex);
  }

  private selectPhoto(index: number, showViewer: boolean = false): void {
    if (this.today === null || index < 0 || index >= this.today.photos.length) return;
    this.selectedPhotoIndex = index;
    this.showPhotoViewer = showViewer || this.showPhotoViewer;
    this.loadPhotoPixel(index);
  }

  private async restoreRecordDraft(): Promise<void> {
    if (this.adapter === null) return;
    const value = await this.adapter.readRecordDraft();
    if (value === null) return;
    const draft = value as Record<string, Object>;
    const type = String(draft['type'] || '');
    if (!['feeding', 'sleep', 'diaper', 'medication', 'temperature', 'growth'].includes(type)) return;
    this.selectedRecordType = type as NativeRecordType;
    this.recordValue = String(draft['value'] || '');
    this.recordExtra = String(draft['extra'] || '');
    this.recordOption = String(draft['option'] || '');
    this.recordCommandId = String(draft['commandId'] || '');
    this.feedbackMessage = '已恢复未提交的本机草稿；不会离线排队创建事实。';
  }

  private openRecord(type: NativeRecordType): void {
    this.selectedRecordType = type;
    this.recordValue = '';
    this.recordExtra = '';
    this.recordOption = type === 'feeding' ? 'formula' : type === 'diaper' ? 'urine' : type === 'growth' ? 'weight' : '';
    this.recordCommandId = `native-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    this.recordError = '';
    this.correctionEventId = '';
    this.correctionEventVersion = 1;
    this.correctionOccurredAt = '';
    this.correctionOriginalEvent = null;
    this.saveDraft();
  }

  private async openCorrection(fact: NativeTodayFact): Promise<void> {
    if (this.adapter === null || this.today === null || this.busy) return;
    const type: NativeRecordType = fact.category === 'breastfeeding' || fact.category === 'bottle_feeding' ? 'feeding'
      : fact.category === 'temperature_observation' || fact.category === 'temperature' ? 'temperature'
        : fact.category === 'growth_measurement' ? 'growth' : fact.category as NativeRecordType;
    this.busy = true;
    try {
      const found = await this.adapter.findCareEvent(String(this.today.baby['id']), fact.id);
      if (found === null) throw new Error('原事实已变化或不可读取，请刷新时间线后重试。');
      const event = found as NativeCareEvent;
      const payload = event.payload;
      this.openRecord(type);
      this.correctionEventId = event.id;
      this.correctionEventVersion = event.version;
      this.correctionOccurredAt = event.occurredAt;
      this.correctionOriginalEvent = event;
      if (type === 'feeding') {
        this.recordOption = event.category === 'breastfeeding' ? 'breastfeeding' : String(payload['milkType'] || 'formula');
        this.recordValue = payload['amountMl'] === null || payload['amountMl'] === undefined ? '' : String(payload['amountMl']);
      } else if (type === 'sleep') {
        this.recordValue = event.occurredAt;
        this.recordExtra = String(payload['endedAt'] || '');
      } else if (type === 'diaper') {
        this.recordOption = String(payload['kind'] || 'urine');
      } else if (type === 'medication') {
        this.recordValue = String(payload['medicationName'] || payload['name'] || '');
        this.recordExtra = String(payload['amount'] || '');
      } else if (type === 'temperature') {
        this.recordValue = payload['value'] === null || payload['value'] === undefined ? '' : String(payload['value']);
        this.recordOption = String(payload['method'] || 'axillary');
      } else {
        this.recordValue = payload['value'] === null || payload['value'] === undefined ? '' : String(payload['value']);
        this.recordOption = String(payload['type'] || 'weight');
      }
      await this.saveDraft();
      this.feedbackMessage = '正在纠正既有事实；已载入原字段、发生时间和版本。';
    } catch (error) {
      this.feedbackMessage = error instanceof Error ? error.message : '原事实读取失败，请刷新后重试。';
    } finally {
      this.busy = false;
    }
  }

  private closeRecord(): void {
    this.selectedRecordType = null;
    this.recordError = '';
  }

  private async saveDraft(): Promise<void> {
    if (this.adapter === null || this.selectedRecordType === null) return;
    const draft: NativeRecordDraft = { type: this.selectedRecordType, value: this.recordValue, extra: this.recordExtra, option: this.recordOption, commandId: this.recordCommandId };
    await this.adapter.saveRecordDraft(draft);
  }

  private correctionPayload(edited: Record<string, Object | null>, replacedFields: Array<string>): Record<string, Object | null> {
    if (this.correctionOriginalEvent === null) return edited;
    const original = this.correctionOriginalEvent.payload;
    const merged = jsonRecord('{}');
    for (const field of Object.keys(original)) if (!replacedFields.includes(field)) merged[field] = original[field];
    for (const field of Object.keys(edited)) merged[field] = edited[field];
    return merged;
  }

  private recordPayload(): Record<string, Object | null> {
    if (this.selectedRecordType === 'feeding') return this.correctionPayload(this.recordOption === 'breastfeeding' ? jsonRecord('{"mode":"breastfeeding"}') : jsonRecord(`{"milkType":${JSON.stringify(this.recordOption === 'breast_milk' ? 'breast_milk' : 'formula')},"amountMl":${this.recordValue.trim().length === 0 ? 'null' : Number(this.recordValue)},"unit":"mL"}`), ['mode', 'milkType', 'amountMl', 'unit']);
    if (this.selectedRecordType === 'sleep') return this.correctionPayload(jsonRecord(`{"endedAt":${JSON.stringify(this.recordExtra)}}`), ['endedAt']);
    if (this.selectedRecordType === 'diaper') return this.correctionPayload(jsonRecord(`{"kind":${JSON.stringify(this.recordOption || 'urine')}}`), ['kind']);
    if (this.selectedRecordType === 'medication') return this.correctionPayload(jsonRecord(`{"medicationName":${JSON.stringify(this.recordValue.trim())},"amount":${JSON.stringify(this.recordExtra.trim())}}`), ['medicationName', 'name', 'amount']);
    if (this.selectedRecordType === 'temperature') return this.correctionPayload(this.recordValue.trim().length === 0 ? jsonRecord('{"value":null}') : jsonRecord(`{"value":${Number(this.recordValue)},"unit":"°C","method":${JSON.stringify(this.recordOption || 'axillary')}}`), ['value', 'unit', 'method']);
    const unit = this.recordOption === 'weight' ? 'kg' : 'cm';
    return this.correctionPayload(jsonRecord(`{"type":${JSON.stringify(this.recordOption || 'weight')},"value":${Number(this.recordValue)},"unit":${JSON.stringify(unit)},"measuredAt":${JSON.stringify(this.selectedDay)}}`), ['type', 'value', 'unit', 'measuredAt']);
  }

  private recordOccurredAt(): string {
    if (this.correctionOccurredAt.length > 0) return this.correctionOccurredAt;
    if (this.selectedRecordType === 'sleep' && this.recordValue.length > 0) return this.recordValue;
    const parts = this.selectedDay.split('-').map((value: string) => Number(value));
    if (parts.length !== 3 || parts.some((value: number) => !Number.isInteger(value))) return new Date().toISOString();
    const now = new Date();
    return new Date(parts[0], parts[1] - 1, parts[2], now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
  }

  private restoreEvent(original: NativeCareEvent): NativeCareEvent {
    return {
      id: `native-undo-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      babyId: original.babyId,
      kind: original.kind,
      category: original.category,
      occurredAt: original.occurredAt,
      recordedAt: new Date().toISOString(),
      actor: original.actor,
      source: original.source,
      payload: original.payload,
      status: 'active',
      version: 1
    };
  }

  private armUndo(saved: Record<string, Object>, original: NativeCareEvent | null): void {
    this.undoEventId = String(saved['id']);
    this.undoEventVersion = Number(saved['version'] || 1);
    this.undoCorrectionOriginal = original;
    this.feedbackMessage = original === null ? '保存成功 · 已同步。约五秒内可撤销。' : '纠正成功 · 已同步。约五秒内可恢复原事实。';
    this.lightHaptic();
    setTimeout(() => {
      if (this.undoEventId === String(saved['id'])) {
        this.undoEventId = '';
        this.undoCorrectionOriginal = null;
      }
    }, 5000);
  }

  private async saveRecord(): Promise<void> {
    if (this.adapter === null || this.today === null || this.selectedRecordType === null || this.busy) return;
    this.busy = true;
    this.recordError = '';
    const original = this.correctionOriginalEvent;
    try {
      const command: NativeCareCommand = createNativeCareCommand({
        type: this.selectedRecordType,
        babyId: String(this.today.baby['id']),
        recorderId: String(this.today.recorder['id']),
        recorderName: String(this.today.recorder['displayName']),
        occurredAt: this.recordOccurredAt(),
        payload: this.recordPayload(),
        idempotencyId: this.recordCommandId
      });
      const response = this.correctionEventId.length > 0
        ? await this.adapter.correctCareEvent(this.correctionEventId, this.correctionEventVersion, command.event) as Record<string, Object>
        : await this.adapter.createCareEvent(command) as Record<string, Object>;
      let saved = response['event'] as Record<string, Object> | null;
      if (!saved) saved = await this.adapter.findCareEvent(String(this.today.baby['id']), this.recordCommandId) as Record<string, Object> | null;
      if (!saved) throw new Error('响应状态不明，服务端尚未确认记录；请重试查询，不会重复创建。');
      this.armUndo(saved, original);
      this.selectedRecordType = null;
      this.correctionOriginalEvent = null;
      this.correctionOccurredAt = '';
      await this.adapter.saveRecordDraft(null);
      await this.loadToday();
    } catch (error) {
      const found = await this.adapter.findCareEvent(String(this.today.baby['id']), this.recordCommandId).catch(() => null);
      if (found !== null) {
        const event = found as Record<string, Object>;
        this.armUndo(event, original);
        this.selectedRecordType = null;
        this.correctionOriginalEvent = null;
        this.correctionOccurredAt = '';
        await this.adapter.saveRecordDraft(null);
        await this.loadToday();
        return;
      }
      this.recordError = error instanceof Error ? error.message : '保存未完成，请核对后重试。';
      await this.saveDraft();
    } finally {
      this.busy = false;
    }
  }

  private async voidFact(fact: NativeTodayFact): Promise<void> {
    if (this.adapter === null || this.busy) return;
    this.busy = true;
    try {
      await this.adapter.voidCareEvent(fact.id, fact.version);
      this.feedbackMessage = '事实已永久作废；原记录人、版本与审计关系保留。';
      await this.loadToday();
    } catch (error) {
      this.feedbackMessage = error instanceof Error ? error.message : '作废未完成，请刷新后核对。';
    } finally {
      this.busy = false;
    }
  }

  private shiftDay(offset: number): void {
    const base = new Date(`${this.selectedDay}T12:00:00.000Z`);
    base.setUTCDate(base.getUTCDate() + offset);
    this.loadToday(base.toISOString().slice(0, 10));
  }

  private async undoRecord(): Promise<void> {
    if (this.adapter === null || this.undoEventId.length === 0) return;
    this.busy = true;
    try {
      if (this.undoCorrectionOriginal !== null) {
        await this.adapter.correctCareEvent(this.undoEventId, this.undoEventVersion, this.restoreEvent(this.undoCorrectionOriginal));
        this.feedbackMessage = '已撤销纠正并恢复原事实；完整纠正链仍保留。';
      } else {
        await this.adapter.voidCareEvent(this.undoEventId, this.undoEventVersion);
        this.feedbackMessage = '已撤销，事实永久作废；历史记录人和版本仍保留。';
      }
      this.undoEventId = '';
      this.undoCorrectionOriginal = null;
      await this.loadToday();
    } catch (error) {
      this.feedbackMessage = error instanceof Error ? error.message : '撤销未完成，请刷新时间线核对。';
    } finally {
      this.busy = false;
    }
  }

  private async lightHaptic(): Promise<void> {
    const effect: vibrator.VibrateTime = { type: 'time', duration: 24 };
    const attribute: vibrator.VibrateAttribute = { usage: 'touch' };
    try { await vibrator.startVibration(effect, attribute); } catch { /* 设备可不支持触觉反馈 */ }
  }

  private async choosePhoto(): Promise<void> {
    if (this.adapter === null || this.today === null || !Boolean(this.today.permissions['canEdit'])) {
      this.photoMessage = '当前为只读状态，不能导入照片。';
      return;
    }
    const picker = new photoAccessHelper.PhotoViewPicker();
    try {
      const result = await picker.select({ MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE, maxSelectNumber: 1 });
      if (result.photoUris.length === 0) return;
      const timestamp = await this.photoTimestamp(result.photoUris[0]);
      await this.uploadChosenPhoto(result.photoUris[0], timestamp);
    } catch (error) {
      this.photoMessage = error instanceof NativeTransportError ? error.message : '照片访问未获允许；可在系统设置授权后重试。';
    } finally {
      this.busy = false;
    }
  }

  private async capturePhoto(): Promise<void> {
    if (this.adapter === null || this.today === null || !Boolean(this.today.permissions['canEdit'])) {
      this.photoMessage = '当前为只读状态，不能拍摄导入照片。';
      return;
    }
    try {
      const profile = new cameraPicker.PickerProfile();
      profile.cameraPosition = camera.CameraPosition.CAMERA_POSITION_BACK;
      const result = await cameraPicker.pick(getContext(this), [cameraPicker.PickerMediaType.PHOTO], profile);
      if (result.resultUri.length > 0) await this.uploadChosenPhoto(result.resultUri, { takenAt: new Date().toISOString(), timeSource: 'upload' });
    } catch {
      this.photoMessage = '相机未获允许或拍摄已取消；可在系统设置授权后重试。';
    }
  }

  private async photoTimestamp(uri: string): Promise<NativePhotoTimestamp> {
    try {
      const source = image.createImageSource(uri);
      const original = await source.getImageProperty(image.PropertyKey.DATE_TIME_ORIGINAL);
      await source.release();
      const match = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(original);
      if (match !== null) {
        const taken = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
        if (!Number.isNaN(taken.getTime())) return { takenAt: taken.toISOString(), timeSource: 'exif' };
      }
    } catch { /* 继续使用可访问文件的修改时间。 */ }
    try {
      const stat = await fileIo.stat(uri);
      if (Number.isFinite(stat.mtime) && stat.mtime > 0) return { takenAt: new Date(stat.mtime).toISOString(), timeSource: 'file' };
    } catch { /* 最终退回上传时间，并标记真实来源。 */ }
    return { takenAt: new Date().toISOString(), timeSource: 'upload' };
  }

  private async uploadChosenPhoto(uri: string, timestamp: NativePhotoTimestamp): Promise<void> {
    if (this.adapter === null || this.today === null) return;
    this.photoMessage = '正在上传所选照片…';
    this.busy = true;
    try {
      await this.adapter.uploadPhoto(uri, String(this.today.baby['id']), timestamp.takenAt, timestamp.timeSource);
      this.photoMessage = '照片已保存到共享相册；原图不会自动发送给 AI。';
      await this.loadToday();
    } finally {
      this.busy = false;
    }
  }

  private async deleteSelectedPhoto(): Promise<void> {
    if (this.adapter === null || this.today === null || this.today.photos.length === 0) return;
    const photo = this.today.photos[this.selectedPhotoIndex];
    this.busy = true;
    try {
      await this.adapter.deletePhoto(photo.id);
      this.photoMessage = '照片已删除。';
      this.showPhotoViewer = false;
      this.selectedPhotoIndex = 0;
      await this.loadToday();
    } catch (error) {
      this.photoMessage = error instanceof Error ? error.message : '照片删除未完成。';
    } finally {
      this.busy = false;
    }
  }

  private async downloadSelectedPhoto(): Promise<void> {
    if (this.adapter === null || this.today === null || this.today.photos.length === 0) return;
    const photo = this.today.photos[this.selectedPhotoIndex];
    this.busy = true;
    try {
      const downloaded = await this.adapter.downloadPhoto(photo.id);
      const extension = downloaded.contentType.includes('png') ? 'png' : downloaded.contentType.includes('webp') ? 'webp' : downloaded.contentType.includes('heic') ? 'heic' : 'jpg';
      const documentPicker = new picker.DocumentViewPicker(getContext(this));
      const options = new picker.DocumentSaveOptions();
      options.newFileNames = [`babyforge-${photo.id}.${extension}`];
      const destinations = await documentPicker.save(options);
      if (destinations.length === 0) return;
      const file = await fileIo.open(destinations[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC);
      try { await fileIo.write(file.fd, downloaded.data); } finally { await fileIo.close(file); }
      this.photoMessage = '照片已下载到所选位置。';
    } catch (error) {
      this.photoMessage = error instanceof Error ? error.message : '照片下载未完成。';
    } finally {
      this.busy = false;
    }
  }

  private async signIn(): Promise<void> {
    if (this.adapter === null || this.email.trim().length === 0 || this.password.length === 0) {
      this.statusMessage = '请输入邮箱和密码。';
      return;
    }
    this.busy = true;
    try {
      const result = await this.adapter.signInEmail(this.email.trim(), this.password);
      this.applyResource(result);
      this.password = '';
      this.needsVerification = false;
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '登录失败，请重试。';
      this.needsVerification = error instanceof NativeTransportError && (error.code === 'EMAIL_NOT_VERIFIED' || error.status === 403);
      this.phase = 'login';
    } finally {
      this.busy = false;
    }
  }

  private async register(): Promise<void> {
    if (this.adapter === null || this.email.trim().length === 0 || this.password.length === 0) {
      this.statusMessage = '请输入邮箱和密码。';
      return;
    }
    this.busy = true;
    try {
      await this.adapter.register(this.email.trim(), this.password);
      this.loginMode = 'login';
      this.statusMessage = '注册完成，请查收验证邮件后再登录。';
      this.needsVerification = true;
      this.password = '';
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '注册失败，请重试。';
    } finally {
      this.busy = false;
    }
  }

  private async resendVerification(): Promise<void> {
    if (this.adapter === null || this.email.trim().length === 0) {
      this.statusMessage = '请输入注册邮箱。';
      return;
    }
    this.busy = true;
    try {
      await this.adapter.resendVerification(this.email.trim());
      this.statusMessage = '验证邮件已重新发送，请检查收件箱。';
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '验证邮件暂时无法发送。';
    } finally {
      this.busy = false;
    }
  }

  private async resetPassword(): Promise<void> {
    if (this.adapter === null || this.email.trim().length === 0) {
      this.statusMessage = '请输入注册邮箱。';
      return;
    }
    this.busy = true;
    try {
      await this.adapter.requestPasswordReset(this.email.trim());
      this.loginMode = 'login';
      this.statusMessage = '如果邮箱存在，重置邮件将发送到该邮箱。';
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '重置邮件暂时无法发送。';
    } finally {
      this.busy = false;
    }
  }

  private async socialLogin(): Promise<void> {
    if (this.adapter === null) return;
    this.busy = true;
    try {
      const url = await this.adapter.startSocialLogin('google');
      const context = getContext(this) as common.UIAbilityContext;
      await context.openLink(url);
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '第三方登录暂时不可用。';
    } finally {
      this.busy = false;
    }
  }

  private async createHousehold(): Promise<void> {
    if (this.adapter === null || this.householdName.trim().length === 0 || this.babyNickname.trim().length === 0 || this.babyBirthDate.trim().length === 0) {
      this.statusMessage = '请补充家庭名称、宝宝昵称和出生日期。';
      return;
    }
    this.busy = true;
    try {
      const baby: NativeBabyInput = {
        nickname: this.babyNickname.trim(),
        birthDate: this.babyBirthDate.trim()
      };
      const result = await this.adapter.createHousehold(this.householdName.trim(), baby);
      this.applyResource(result);
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '家庭创建失败，请重试。';
    } finally {
      this.busy = false;
    }
  }

  private async previewInvite(): Promise<void> {
    if (this.adapter === null || this.inviteToken.trim().length === 0) {
      this.statusMessage = '请输入邀请链接或邀请码。';
      return;
    }
    this.busy = true;
    try {
      const preview = await this.adapter.previewInvite(this.inviteToken.trim());
      const value = preview as Record<string, Object>;
      const invite = value['invite'] as Record<string, Object>;
      this.invitePreview = `将加入「${String(invite['householdName'] || '家庭')}」${invite['babyNickname'] ? `，宝宝：${String(invite['babyNickname'])}` : ''}`;
      this.statusMessage = '请确认后加入家庭。';
    } catch (error) {
      this.invitePreview = '';
      this.statusMessage = error instanceof Error ? error.message : '邀请链接无效或已过期。';
    } finally {
      this.busy = false;
    }
  }

  private async acceptInvite(): Promise<void> {
    if (this.adapter === null || this.inviteToken.trim().length === 0) return;
    this.busy = true;
    try {
      const result = await this.adapter.acceptInvite(this.inviteToken.trim());
      this.applyResource(result);
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '加入家庭失败，请重试。';
    } finally {
      this.busy = false;
    }
  }

  private async createInvite(): Promise<void> {
    if (this.adapter === null) return;
    this.busy = true;
    try {
      const value = await this.adapter.createInvite() as Record<string, Object>;
      const invite = value['invite'] as Record<string, Object>;
      this.statusMessage = `邀请已生成：${String(invite['url'] || '请从服务器复制邀请链接')}`;
      const result = await this.adapter.bootstrap();
      this.applyResource(result);
      this.showFamilyPanel = true;
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : '邀请生成失败，请重试。';
    } finally {
      this.busy = false;
    }
  }

  private async logout(): Promise<void> {
    if (this.adapter === null) return;
    this.busy = true;
    try {
      await this.adapter.logout();
      this.resource = null;
      this.phase = 'login';
      this.loginMode = 'login';
      this.statusMessage = '已安全退出。';
    } finally {
      this.busy = false;
    }
  }

  private selectTab(tab: NativeTab): void {
    if (this.activeTab === tab) this.navigation.repeat(tab);
    this.activeTab = tab;
    this.selectedRoute = this.navigation.state(tab).stack[this.navigation.state(tab).stack.length - 1];
    this.syncNavigation();
  }

  private openSurfaceDetail(route: string): void {
    this.navigation.push(this.activeTab, route);
    this.selectedRoute = route;
    this.syncNavigation();
  }

  private syncNavigation(): void {
    this.selectedRoute = this.navigation.state(this.activeTab).stack[this.navigation.state(this.activeTab).stack.length - 1];
  }

  private surfaceTitle(): string {
    if (this.activeTab === 'today') return '今天';
    if (this.activeTab === 'record') return '记录';
    if (this.activeTab === 'ai') return '奶爸 AI';
    if (this.activeTab === 'growth') return '成长';
    return '探索';
  }

  private surfaceDetail(): string {
    if (this.selectedRoute.endsWith('.root')) return '原生业务表面已注册，页面模型将从共享业务合同加载。';
    return `当前原生导航栈：${this.selectedRoute}。返回键只处理「${this.surfaceTitle()}」标签栈。`;
  }

  @Builder
  private loadingView(): void {
    Column() {
      Text('BabyForge')
        .fontSize(this.largeText ? 30 : 26)
        .fontWeight(FontWeight.Bold)
        .fontColor('#4E3B35');
      LoadingProgress()
        .width(34)
        .height(34)
        .margin({ top: 22 })
        .color('#E68C75');
      Text('正在恢复账号与家庭…')
        .fontSize(this.largeText ? 17 : 14)
        .fontColor('#806E68')
        .margin({ top: 14 });
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center);
  }

  @Builder
  private loginView(): void {
    Scroll() {
      Column({ space: 14 }) {
        Text('BabyForge')
          .fontSize(this.largeText ? 32 : 28)
          .fontWeight(FontWeight.Bold)
          .fontColor('#4E3B35');
        Text(this.loginMode === 'login' ? '欢迎回到照护空间' : this.loginMode === 'register' ? '创建你的照护账号' : '找回账号访问权限')
          .fontSize(this.largeText ? 21 : 18)
          .fontColor('#4E3B35');
        Text('账号、家庭和宝宝资料来自同一份 BabyForge 共享业务源。')
          .fontSize(this.largeText ? 16 : 13)
          .fontColor('#806E68')
          .textAlign(TextAlign.Center);
        TextInput({ placeholder: '邮箱' })
          .type(InputType.Email)
          .width('100%')
          .height(52)
          .onChange((value: string) => this.email = value);
        if (this.loginMode !== 'reset') {
          TextInput({ placeholder: '密码' })
            .type(InputType.Password)
            .width('100%')
            .height(52)
            .onChange((value: string) => this.password = value);
        }
        if (this.statusMessage.length > 0) {
          Text(this.statusMessage)
            .fontSize(this.largeText ? 16 : 13)
            .fontColor('#B85F53')
            .textAlign(TextAlign.Center);
        }
        Button(this.busy ? '处理中…' : this.loginMode === 'login' ? '登录并恢复家庭' : this.loginMode === 'register' ? '注册账号' : '发送重置邮件')
          .width('100%')
          .height(50)
          .enabled(!this.busy)
          .fontColor(Color.White)
          .backgroundColor('#D98372')
          .borderRadius(25)
          .onClick(() => {
            if (this.loginMode === 'login') this.signIn();
            else if (this.loginMode === 'register') this.register();
            else this.resetPassword();
          });
        if (this.loginMode === 'login') {
          Button('使用 Google 登录')
            .width('100%')
            .height(46)
            .backgroundColor('#FFF9F0')
            .borderColor('#E8D8CE')
            .borderWidth(1)
            .borderRadius(23)
            .onClick(() => this.socialLogin());
          Row({ space: 16 }) {
            Button('注册').backgroundColor(Color.Transparent).fontColor('#9A665C').onClick(() => { this.loginMode = 'register'; this.statusMessage = ''; });
            Button('忘记密码').backgroundColor(Color.Transparent).fontColor('#9A665C').onClick(() => { this.loginMode = 'reset'; this.statusMessage = ''; });
          }
          if (this.needsVerification) {
            Button('重发验证邮件')
              .backgroundColor(Color.Transparent)
              .fontColor('#7A9A80')
              .enabled(!this.busy)
              .onClick(() => this.resendVerification());
          }
        } else {
          Button('返回登录').backgroundColor(Color.Transparent).fontColor('#9A665C').onClick(() => { this.loginMode = 'login'; this.statusMessage = ''; });
        }
      }
      .width('100%')
      .padding({ left: 24, right: 24, top: 46, bottom: 32 });
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private householdView(): void {
    Scroll() {
      Column({ space: 14 }) {
        Text('进入家庭空间')
          .fontSize(this.largeText ? 28 : 24)
          .fontWeight(FontWeight.Bold)
          .fontColor('#4E3B35');
        Text('创建家庭，或使用邀请加入已有家庭。')
          .fontSize(this.largeText ? 16 : 13)
          .fontColor('#806E68');
        Text('创建家庭')
          .fontSize(this.largeText ? 20 : 17)
          .fontWeight(FontWeight.Bold)
          .fontColor('#4E3B35')
          .margin({ top: 12 });
        TextInput({ placeholder: '家庭名称' }).width('100%').height(50).onChange((value: string) => this.householdName = value);
        TextInput({ placeholder: '宝宝昵称' }).width('100%').height(50).onChange((value: string) => this.babyNickname = value);
        TextInput({ placeholder: '出生日期 YYYY-MM-DD' }).width('100%').height(50).onChange((value: string) => this.babyBirthDate = value);
        Button(this.busy ? '处理中…' : '创建家庭')
          .width('100%')
          .height(48)
          .enabled(!this.busy)
          .fontColor(Color.White)
          .backgroundColor('#D98372')
          .borderRadius(24)
          .onClick(() => this.createHousehold());
        Divider().margin({ top: 10, bottom: 10 });
        Text('加入家庭')
          .fontSize(this.largeText ? 20 : 17)
          .fontWeight(FontWeight.Bold)
          .fontColor('#4E3B35');
        TextInput({ placeholder: '粘贴邀请链接或邀请码' }).width('100%').height(50).onChange((value: string) => this.inviteToken = value);
        Button('预览邀请').width('100%').height(46).enabled(!this.busy).onClick(() => this.previewInvite());
        if (this.invitePreview.length > 0) {
          Text(this.invitePreview).fontSize(this.largeText ? 16 : 13).fontColor('#4E3B35').textAlign(TextAlign.Center);
          Button('确认加入家庭').width('100%').height(46).enabled(!this.busy).fontColor(Color.White).backgroundColor('#7A9A80').borderRadius(23).onClick(() => this.acceptInvite());
        }
        if (this.statusMessage.length > 0) Text(this.statusMessage).fontSize(this.largeText ? 16 : 13).fontColor('#B85F53').textAlign(TextAlign.Center);
        Button('退出账号').backgroundColor(Color.Transparent).fontColor('#9A665C').onClick(() => this.logout());
      }
      .width('100%')
      .padding({ left: 24, right: 24, top: 30, bottom: 30 });
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private familyPanel(): void {
    Column() {
      Row() {
        Text('家庭与权限').fontSize(this.largeText ? 23 : 19).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1);
        Button('关闭').backgroundColor(Color.Transparent).fontColor('#9A665C').onClick(() => this.showFamilyPanel = false);
      }
      if (this.resource?.household) {
        Text(`${this.resource.household.name} · ${roleLabel(this.resource.household.role)}`).fontSize(this.largeText ? 16 : 13).fontColor('#806E68').margin({ top: 8, bottom: 12 });
        ForEach(this.resource.household.members, (member: NativeMember) => {
          Row() {
            Text(member.displayName).fontSize(this.largeText ? 17 : 14).fontColor('#4E3B35').layoutWeight(1);
            Text(`${roleLabel(member.role)}${member.active ? '' : ' · 已停用'}`).fontSize(this.largeText ? 15 : 12).fontColor('#806E68');
          }.padding({ top: 9, bottom: 9 });
        }, (member: NativeMember) => member.id);
        if (this.resource.permissions.canManageHousehold) {
          Button('生成成员邀请').width('100%').height(44).margin({ top: 8 }).onClick(() => this.createInvite());
        }
        if (this.statusMessage.length > 0) Text(this.statusMessage).fontSize(this.largeText ? 15 : 12).fontColor('#B85F53').margin({ top: 10 });
      }
      Button('安全退出').width('100%').height(44).margin({ top: 16 }).fontColor(Color.White).backgroundColor('#C36B63').borderRadius(22).onClick(() => this.logout());
    }
    .width('100%')
    .padding({ left: 22, right: 22, top: 22, bottom: 18 })
    .backgroundColor('#FFFCF8')
    .borderRadius(24)
    .shadow({ radius: 18, color: '#3E302515', offsetY: 8, offsetX: 0 });
  }

  @Builder
  private nativeHeader(title: string, subtitle: string): void {
    Row() {
      Column() {
        Text(title).fontSize(this.largeText ? 29 : 24).fontWeight(FontWeight.Bold).fontColor('#4E3B35');
        Text(subtitle).fontSize(this.largeText ? 16 : 13).fontColor('#806E68').margin({ top: 4 });
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
      Button('家庭').height(38).backgroundColor('#FFF1EB').fontColor('#9A665C').borderRadius(19).onClick(() => this.showFamilyPanel = true);
    }.width('100%');
  }

  @Builder
  private metricCard(label: string, metric: Object, type: NativeRecordType): void {
    Column({ space: 5 }) {
      Text(label).fontSize(this.largeText ? 15 : 12).fontColor('#806E68');
      Text(String((metric as Record<string, Object>)['label'] || '未记录')).fontSize(this.largeText ? 20 : 17).fontWeight(FontWeight.Bold).fontColor('#4E3B35');
      Button('快速记录').height(30).fontSize(this.largeText ? 13 : 11).backgroundColor(Color.Transparent).fontColor('#A65E51').onClick(() => this.openRecord(type));
    }
    .layoutWeight(1)
    .padding({ top: 13, bottom: 10 })
    .backgroundColor('#FFF5EE')
    .borderRadius(16);
  }

  @Builder
  private todaySurface(): void {
    Column({ space: 16 }) {
      this.nativeHeader(`早上好，${String(this.today?.baby['nickname'] || '宝宝')}`, `${this.selectedDay} · ${this.today?.dataTimezone || '当地自然日'}`);
      if (this.staleCache) Text(this.statusMessage).width('100%').fontSize(12).fontColor('#8A6742').backgroundColor('#FFF3D8').borderRadius(12).padding(10);
      Row({ space: 8 }) {
        Button('前一天').layoutWeight(1).height(38).onClick(() => this.shiftDay(-1));
        Button(this.selectedDay || '今天').layoutWeight(2).height(38).fontWeight(FontWeight.Bold).backgroundColor('#FFE8DE').fontColor('#4E3B35');
        Button('后一天').layoutWeight(1).height(38).onClick(() => this.shiftDay(1));
      }.width('100%').accessibilityText(`日期条，当前 ${this.selectedDay}`);
      if (this.todayPhase === 'loading') {
        Column({ space: 10 }) { LoadingProgress().width(28).height(28); Text('正在读取今天的共享页面模型…').fontColor('#806E68'); }.width('100%').padding(28);
      } else if (this.todayPhase === 'error' || this.today === null) {
        Column({ space: 10 }) { Text(this.statusMessage).fontColor('#B85F53'); Button('重试').onClick(() => this.loadToday()); }.width('100%').padding(24).backgroundColor('#FFFCF8').borderRadius(18);
      } else {
        Column({ space: 10 }) {
          Row() { Text('今日摘要').fontSize(this.largeText ? 21 : 18).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Text('确定性结果').fontSize(11).fontColor('#7A9A80'); }
          Row({ space: 8 }) {
            this.metricCard('喂养', this.today.summary.feeding, 'feeding');
            this.metricCard('睡眠', this.today.summary.sleep, 'sleep');
            this.metricCard('尿布', this.today.summary.diaper, 'diaper');
          }.width('100%');
          Text(String(this.today.guidance['feeding'])).fontSize(this.largeText ? 14 : 11).fontColor('#806E68');
          Text(String(this.today.guidance['analysis'])).fontSize(this.largeText ? 14 : 11).fontColor('#806E68');
        }.width('100%').padding(16).backgroundColor('#FFFCF8').borderRadius(20);

        Column({ space: 10 }) {
          Row() { Column() { Text('今日相册').fontSize(12).fontColor('#A65E51'); Text('刚刚好的小日子').fontSize(this.largeText ? 21 : 18).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); }.alignItems(HorizontalAlign.Start).layoutWeight(1); Button('按日期浏览').fontSize(12).onClick(() => this.feedbackMessage = '使用上方日期条浏览当地自然日照片。'); }
          if (this.today.photos.length === 0) {
            Column({ space: 8 }) { Text('今天还没有照片').fontSize(this.largeText ? 18 : 15).fontWeight(FontWeight.Bold); Text('可从系统照片选择器或拍摄入口导入。').fontSize(12).fontColor('#806E68'); Row({ space: 8 }) { Button('选择照片').onClick(() => this.choosePhoto()); Button('拍摄导入').onClick(() => this.capturePhoto()); } }.width('100%').height(180).justifyContent(FlexAlign.Center).backgroundColor('#F8EEE6').borderRadius(18);
          } else if (this.photoLoadFailed) {
            Column({ space: 8 }) { Text('相册暂时无法加载').fontSize(this.largeText ? 18 : 15).fontWeight(FontWeight.Bold); Button('重试').onClick(() => this.retryPhotos()); }.width('100%').height(180).justifyContent(FlexAlign.Center).backgroundColor('#F8EEE6').borderRadius(18);
          } else if (this.photoLoading || this.photoPixel === null) {
            Column({ space: 8 }) { LoadingProgress().width(28).height(28); Text('正在加载相册…').fontSize(12).fontColor('#806E68'); }.width('100%').height(180).justifyContent(FlexAlign.Center).backgroundColor('#F8EEE6').borderRadius(18);
          } else {
            Swiper() {
              ForEach(this.today.photos, (photo: NativeTodayPhoto, index: number) => {
                Stack({ alignContent: Alignment.BottomStart }) {
                  if (index === this.selectedPhotoIndex && this.photoPixel !== null) {
                    Image(this.photoPixel).width('100%').height(230).objectFit(ImageFit.Cover).alt(photo.caption || '宝宝照片');
                  } else {
                    Column() { Text('滑动后按需加载').fontSize(12).fontColor('#806E68'); }.width('100%').height(230).justifyContent(FlexAlign.Center).backgroundColor('#F8EEE6');
                  }
                  Column() { Text(photo.caption || '宝宝照片').fontSize(15).fontWeight(FontWeight.Bold).fontColor(Color.White); Text(photo.takenAt).fontSize(11).fontColor(Color.White); }.width('100%').padding(12).backgroundColor('#33251F80').alignItems(HorizontalAlign.Start);
                }.width('100%').borderRadius(18).clip(true).onClick(() => this.selectPhoto(index, true));
              }, (photo: NativeTodayPhoto) => photo.id);
            }.width('100%').height(230).loop(false).indicator(true).index(this.selectedPhotoIndex).onChange((index: number) => this.selectPhoto(index));
            Row() { Text(`${this.selectedPhotoIndex + 1} / ${this.today.photos.length}`).fontSize(12).fontColor('#806E68').layoutWeight(1); Button('查看更多').fontSize(12).onClick(() => this.selectPhoto(this.selectedPhotoIndex, true)); Button('选择').fontSize(12).onClick(() => this.choosePhoto()); Button('拍摄').fontSize(12).onClick(() => this.capturePhoto()); }.width('100%');
          }
          Text('照片不会自动发送给 AI；报告和分享默认不包含原图。').fontSize(this.largeText ? 14 : 11).fontColor('#7A706B');
          if (this.photoMessage.length > 0) Text(this.photoMessage).fontSize(12).fontColor('#A65E51').accessibilityLevel('yes');
        }.width('100%').padding(16).backgroundColor('#FFFCF8').borderRadius(20);

        Column({ space: 10 }) {
          Row() { Text('今天要留意').fontSize(this.largeText ? 21 : 18).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Text(`${this.today.tasks.filter((task: NativeTodayTask) => task.status !== 'done').length} 项`).fontSize(12).fontColor('#806E68'); }
          if (this.today.tasks.length === 0) Text('今天没有待处理事项。').fontSize(13).fontColor('#806E68').padding(12);
          ForEach(this.today.tasks.slice(0, 5), (task: NativeTodayTask) => {
            Row({ space: 10 }) { Text(task.status === 'done' ? '✓' : '○').fontSize(20).fontColor(task.status === 'done' ? '#7A9A80' : '#D98372'); Column() { Text(task.title).fontSize(this.largeText ? 16 : 14).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); Text(task.detail).fontSize(this.largeText ? 14 : 11).fontColor('#806E68').maxLines(2); Text(task.source).fontSize(10).fontColor('#A28B81'); }.alignItems(HorizontalAlign.Start).layoutWeight(1); }.width('100%').padding(12).backgroundColor('#FFF8F3').borderRadius(14);
          }, (task: NativeTodayTask) => task.id);
        }.width('100%').padding(16).backgroundColor('#FFFCF8').borderRadius(20);

        Column({ space: 10 }) {
          Row() { Text('最近事实').fontSize(this.largeText ? 21 : 18).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Button('全部时间线').fontSize(12).onClick(() => this.selectTab('record')); }
          if (this.today.recentFacts.length === 0) Text('当地自然日内尚无已确认事实。').fontSize(13).fontColor('#806E68').padding(14);
          ForEach(this.today.recentFacts.slice(0, 4), (fact: NativeTodayFact) => {
            Row({ space: 10 }) { Text(fact.localTime).fontSize(12).fontColor('#A65E51'); Column() { Text(fact.title).fontSize(this.largeText ? 16 : 14).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); Text(`${fact.recorder}记录 · 已同步`).fontSize(11).fontColor('#806E68'); }.alignItems(HorizontalAlign.Start).layoutWeight(1); }.width('100%').padding(12).backgroundColor('#FFF8F3').borderRadius(14);
          }, (fact: NativeTodayFact) => fact.id);
        }.width('100%').padding(16).backgroundColor('#FFFCF8').borderRadius(20);

        Row({ space: 8 }) { Button('饮食建议').layoutWeight(1); Button('今日分析').layoutWeight(1); Button('成长计划').layoutWeight(1); Button('就医摘要').layoutWeight(1).onClick(() => { this.selectTab('record'); this.openSurfaceDetail('record.doctor-summary'); }); }.width('100%');
        Text(String(this.today.guidance['source'])).fontSize(11).fontColor('#806E68').textAlign(TextAlign.Center).width('100%');
      }
    }.width('100%');
  }

  @Builder
  private recordCard(type: NativeRecordType, tone: string): void {
    Button() {
      Column({ space: 8 }) {
        Image(recordArt(type)).width(78).height(58).objectFit(ImageFit.Contain).alt(`${recordLabel(type)}身体局部水彩插画`);
        Text(recordLabel(type)).fontSize(this.largeText ? 19 : 16).fontWeight(FontWeight.Bold).fontColor('#4E3B35');
        Text('记录一次').fontSize(12).fontColor('#A65E51');
      }.width('100%').padding({ top: 18, bottom: 16 });
    }.height(this.largeText ? 150 : 132).backgroundColor(tone).borderRadius(20).onClick(() => this.openRecord(type)).accessibilityText(`记录${recordLabel(type)}`);
  }

  @Builder
  private recordSurface(): void {
    Column({ space: 16 }) {
      this.nativeHeader('统一记录工作台', `${this.selectedDay} · ${String(this.today?.recorder['displayName'] || '家庭成员')}记录`);
      Text('每张卡只有一个主要动作。已确认身体局部水彩插画仅帮助识别入口，不承载数值或医学状态。').fontSize(this.largeText ? 14 : 11).fontColor('#806E68').width('100%');
      Grid() {
        GridItem() { this.recordCard('feeding', '#FFF0E8'); }
        GridItem() { this.recordCard('sleep', '#F2EEFA'); }
        GridItem() { this.recordCard('diaper', '#EEF5EC'); }
        GridItem() { this.recordCard('medication', '#FFF3E6'); }
        GridItem() { this.recordCard('temperature', '#EAF5F2'); }
        GridItem() { this.recordCard('growth', '#F7F0DE'); }
      }.columnsTemplate('1fr 1fr').columnsGap(10).rowsGap(10).width('100%');
      Column({ space: 8 }) {
        Text('更多记录').fontSize(this.largeText ? 20 : 17).fontWeight(FontWeight.Bold).fontColor('#4E3B35').width('100%');
        ForEach(['基础资料', '症状 / 生病', '照护动作', '专业结论', '关注事项', '咨询问题', '计划', '里程碑'], (label: string) => {
          Button(label).width('100%').height(42).backgroundColor('#FFFCF8').fontColor('#4E3B35').onClick(() => this.openSurfaceDetail(`record.secondary.${label}`));
        }, (label: string) => label);
      }.width('100%').padding(15).backgroundColor('#FFF8F3').borderRadius(20);
      Column({ space: 10 }) {
        Row() { Text('事实时间线').fontSize(this.largeText ? 21 : 18).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Button('就医摘要').fontSize(12).onClick(() => this.openSurfaceDetail('record.doctor-summary')); }
        Row({ space: 6 }) { ForEach(['all', 'feeding', 'sleep', 'diaper', 'other'], (filter: string) => { Button(filter === 'all' ? '全部' : filter === 'feeding' ? '喂养' : filter === 'sleep' ? '睡眠' : filter === 'diaper' ? '尿布' : '其他').height(34).fontSize(11).backgroundColor(this.factFilter === filter ? '#FFE8DE' : '#F5EFEA').fontColor('#4E3B35').onClick(() => this.factFilter = filter); }, (filter: string) => filter); }.width('100%');
        if (!this.today || this.today.recentFacts.length === 0) Text('当地单日内暂无事实。').fontSize(13).fontColor('#806E68').padding(14);
        if (this.today) ForEach(this.today.recentFacts, (fact: NativeTodayFact) => {
          if (this.factFilter === 'all' || (this.factFilter === 'feeding' && (fact.category === 'breastfeeding' || fact.category === 'bottle_feeding')) || fact.category === this.factFilter || (this.factFilter === 'other' && !['breastfeeding', 'bottle_feeding', 'sleep', 'diaper'].includes(fact.category))) {
            Column({ space: 8 }) { Row() { Text(fact.localTime).fontSize(12).fontColor('#A65E51'); Text(fact.title).fontSize(this.largeText ? 16 : 14).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); }; Text(`${fact.recorder} · 版本 ${fact.version} · ${fact.status}`).fontSize(11).fontColor('#806E68').width('100%'); Row({ space: 8 }) { Button('详情').layoutWeight(1).height(32).fontSize(11).onClick(() => this.openSurfaceDetail(`record.fact.${fact.id}`)); Button('纠正').layoutWeight(1).height(32).fontSize(11).enabled(Boolean(this.today?.permissions['canEdit'])).onClick(() => this.openCorrection(fact)); Button('永久作废').layoutWeight(1).height(32).fontSize(11).enabled(Boolean(this.today?.permissions['canEdit'])).onClick(() => this.voidFact(fact)); }.width('100%'); }.width('100%').padding(12).backgroundColor('#FFFCF8').borderRadius(14);
          }
        }, (fact: NativeTodayFact) => fact.id);
      }.width('100%').padding(15).backgroundColor('#FFF8F3').borderRadius(20);
      Text('未提交输入仅保存在本机；不会离线排队。冲突、只读或响应不明时不显示假成功。').fontSize(11).fontColor('#806E68').width('100%');
    }.width('100%');
  }

  @Builder
  private recordDetailSurface(): void {
    Column({ space: 16 }) {
      Row() { Button('返回').onClick(() => { this.navigation.back('record'); this.syncNavigation(); }); Text(this.selectedRoute === 'record.doctor-summary' ? '就医摘要' : this.selectedRoute.startsWith('record.fact.') ? '事实详情' : this.selectedRoute.replace('record.secondary.', '')).fontSize(this.largeText ? 24 : 20).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1).textAlign(TextAlign.Center); Blank().width(60); }.width('100%');
      if (this.selectedRoute === 'record.doctor-summary') {
        Column({ space: 10 }) { Text('当地单日就医摘要').fontSize(this.largeText ? 20 : 17).fontWeight(FontWeight.Bold).fontColor('#4E3B35').width('100%'); Text('仅整理已确认事实、记录人与时间；不混入未确认推断，保持桌面端来源与安全说明。').fontSize(12).fontColor('#806E68').width('100%'); if (this.today) ForEach(this.today.recentFacts, (fact: NativeTodayFact) => { Row({ space: 10 }) { Text(fact.localTime).fontSize(12).fontColor('#A65E51'); Text(fact.title).fontSize(14).fontColor('#4E3B35').layoutWeight(1); Text(fact.recorder).fontSize(11).fontColor('#806E68'); }.width('100%').padding(10).backgroundColor('#FFF8F3').borderRadius(12); }, (fact: NativeTodayFact) => fact.id); }.width('100%').padding(16).backgroundColor('#FFFCF8').borderRadius(20);
      } else if (this.selectedRoute.startsWith('record.fact.')) {
        Text('此详情来自共享事实时间线，保留记录人、版本、有效状态和纠正关系。纠正与永久作废请返回时间线操作。').fontSize(this.largeText ? 16 : 13).fontColor('#806E68').width('100%').padding(20).backgroundColor('#FFFCF8').borderRadius(20);
      } else {
        Column({ space: 12 }) { Text('桌面同源低频能力').fontSize(12).fontColor('#A65E51'); Text('此入口沿用共享业务合同、权限、枚举和服务端写入边界；不会维护原生页面专属数据。').fontSize(this.largeText ? 16 : 13).fontColor('#806E68'); Text('可从这里继续处理基础资料、症状事实、照护动作、专业结论、关注事项、咨询问题、计划或里程碑。').fontSize(this.largeText ? 15 : 12).fontColor('#806E68'); }.width('100%').padding(20).backgroundColor('#FFFCF8').borderRadius(20);
      }
    }.width('100%');
  }

  @Builder
  private placeholderSurface(): void {
    Column({ space: 16 }) {
      this.nativeHeader(this.surfaceTitle(), this.resource?.household?.baby?.nickname || '当前宝宝');
      Column({ space: 12 }) { Text(this.activeTab === 'ai' ? '奶爸 AI 原生入口已就绪' : '原生业务表面已就绪').fontSize(this.largeText ? 22 : 18).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); Text(this.surfaceDetail()).fontSize(this.largeText ? 16 : 13).fontColor('#806E68').textAlign(TextAlign.Center); }.width('100%').padding(30).backgroundColor('#FFFCF8').borderRadius(22);
    }.width('100%');
  }

  @Builder
  private nativeSurface(): void {
    if (this.activeTab === 'today') this.todaySurface();
    else if (this.activeTab === 'record' && this.selectedRoute === 'record.root') this.recordSurface();
    else if (this.activeTab === 'record') this.recordDetailSurface();
    else this.placeholderSurface();
  }

  @Builder
  private recordSheet(): void {
    Column({ space: 12 }) {
      Row() { Column() { Text(this.correctionEventId.length > 0 ? '纠正照护事实' : '新增照护事实').fontSize(12).fontColor('#A65E51'); Text(recordLabel(this.selectedRecordType || 'feeding')).fontSize(this.largeText ? 24 : 20).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); }.alignItems(HorizontalAlign.Start).layoutWeight(1); Button('关闭').backgroundColor(Color.Transparent).onClick(() => this.closeRecord()); }
      Image(recordArt(this.selectedRecordType || 'feeding')).width('100%').height(76).objectFit(ImageFit.Contain).alt('身体局部水彩插画，仅作入口识别');
      if (this.selectedRecordType === 'feeding') {
        Row({ space: 7 }) { Button('亲喂').layoutWeight(1).backgroundColor(this.recordOption === 'breastfeeding' ? '#FFE0D3' : '#F5EFEA').onClick(() => { this.recordOption = 'breastfeeding'; this.saveDraft(); }); Button('母乳瓶喂').layoutWeight(1).backgroundColor(this.recordOption === 'breast_milk' ? '#FFE0D3' : '#F5EFEA').onClick(() => { this.recordOption = 'breast_milk'; this.saveDraft(); }); Button('配方奶').layoutWeight(1).backgroundColor(this.recordOption === 'formula' ? '#FFE0D3' : '#F5EFEA').onClick(() => { this.recordOption = 'formula'; this.saveDraft(); }); }.width('100%');
        if (this.recordOption !== 'breastfeeding') TextInput({ text: this.recordValue, placeholder: '实际喝下奶量（mL）' }).type(InputType.Number).onChange((value: string) => { this.recordValue = value; this.saveDraft(); });
      }
      if (this.selectedRecordType === 'sleep') {
        TextInput({ text: this.recordValue, placeholder: '开始时间，例如 2026-08-18T21:00:00+08:00' }).onChange((value: string) => { this.recordValue = value; this.saveDraft(); });
        TextInput({ text: this.recordExtra, placeholder: '结束时间，必须晚于开始时间' }).onChange((value: string) => { this.recordExtra = value; this.saveDraft(); });
        Text('只保存已经确认的完整起止时间。').fontSize(11).fontColor('#806E68');
      }
      if (this.selectedRecordType === 'diaper') {
        Row({ space: 8 }) { Button('尿湿').layoutWeight(1).backgroundColor(this.recordOption === 'urine' ? '#DDECD9' : '#F5EFEA').onClick(() => { this.recordOption = 'urine'; this.saveDraft(); }); Button('排便').layoutWeight(1).backgroundColor(this.recordOption === 'stool' ? '#DDECD9' : '#F5EFEA').onClick(() => { this.recordOption = 'stool'; this.saveDraft(); }); Button('两者都有').layoutWeight(1).backgroundColor(this.recordOption === 'both' ? '#DDECD9' : '#F5EFEA').onClick(() => { this.recordOption = 'both'; this.saveDraft(); }); }.width('100%');
      }
      if (this.selectedRecordType === 'medication') {
        TextInput({ text: this.recordValue, placeholder: '实际使用的药品名称' }).onChange((value: string) => { this.recordValue = value; this.saveDraft(); });
        TextInput({ text: this.recordExtra, placeholder: '实际用量与单位（可选）' }).onChange((value: string) => { this.recordExtra = value; this.saveDraft(); });
        Text('只记录实际发生，不创建服药计划。').fontSize(11).fontColor('#806E68');
      }
      if (this.selectedRecordType === 'temperature') {
        TextInput({ text: this.recordValue, placeholder: '体温数值；留空保存为观察' }).type(InputType.Number).onChange((value: string) => { this.recordValue = value; this.saveDraft(); });
        if (this.recordValue.trim().length > 0) Row({ space: 8 }) { Button('腋下').layoutWeight(1).backgroundColor(this.recordOption === 'axillary' ? '#DDECE7' : '#F5EFEA').onClick(() => { this.recordOption = 'axillary'; this.saveDraft(); }); Button('额头').layoutWeight(1).backgroundColor(this.recordOption === 'forehead' ? '#DDECE7' : '#F5EFEA').onClick(() => { this.recordOption = 'forehead'; this.saveDraft(); }); Button('耳温').layoutWeight(1).backgroundColor(this.recordOption === 'ear' ? '#DDECE7' : '#F5EFEA').onClick(() => { this.recordOption = 'ear'; this.saveDraft(); }); }.width('100%');
      }
      if (this.selectedRecordType === 'growth') {
        Row({ space: 8 }) { Button('体重').layoutWeight(1).backgroundColor(this.recordOption === 'weight' ? '#EFE2BF' : '#F5EFEA').onClick(() => { this.recordOption = 'weight'; this.recordValue = ''; this.saveDraft(); }); Button('身长').layoutWeight(1).backgroundColor(this.recordOption === 'length' ? '#EFE2BF' : '#F5EFEA').onClick(() => { this.recordOption = 'length'; this.recordValue = ''; this.saveDraft(); }); Button('头围').layoutWeight(1).backgroundColor(this.recordOption === 'headCircumference' ? '#EFE2BF' : '#F5EFEA').onClick(() => { this.recordOption = 'headCircumference'; this.recordValue = ''; this.saveDraft(); }); }.width('100%');
        TextInput({ text: this.recordValue, placeholder: this.recordOption === 'weight' ? '数值（kg）' : '数值（cm）' }).type(InputType.Number).onChange((value: string) => { this.recordValue = value; this.saveDraft(); });
        Text(`测量日期 ${this.selectedDay} · 一次保存一个指标`).fontSize(11).fontColor('#806E68');
      }
      if (this.recordError.length > 0) Text(this.recordError).fontSize(12).fontColor('#B85F53').accessibilityLevel('yes');
      Button(this.busy ? '等待服务端确认…' : this.correctionEventId.length > 0 ? '保存纠正' : '保存记录').width('100%').height(48).enabled(!this.busy && Boolean(this.today?.permissions['canEdit'])).fontColor(Color.White).backgroundColor('#D98372').borderRadius(24).onClick(() => this.saveRecord());
      Text('服务端确认后才显示成功；未提交输入只作为本机草稿。').fontSize(11).fontColor('#806E68').textAlign(TextAlign.Center).width('100%');
    }.width('100%').padding({ left: 20, right: 20, top: 18, bottom: 18 }).backgroundColor('#FFFCF8').borderRadius({ topLeft: 26, topRight: 26 }).accessibilityGroup(true);
  }

  @Builder
  private photoViewer(): void {
    if (this.today && this.today.photos.length > 0) {
      Column({ space: 12 }) {
        Row() { Text(`${this.selectedPhotoIndex + 1} / ${this.today.photos.length}`).fontSize(15).fontColor(Color.White).layoutWeight(1); Button('关闭').onClick(() => this.showPhotoViewer = false); }
        if (this.photoLoading) LoadingProgress().width(32).height(32).layoutWeight(1);
        else if (this.photoPixel !== null) Image(this.photoPixel).width('100%').layoutWeight(1).objectFit(ImageFit.Contain).alt(this.today.photos[this.selectedPhotoIndex].caption || '宝宝照片大图');
        Text(this.today.photos[this.selectedPhotoIndex].caption || '宝宝照片').fontSize(17).fontWeight(FontWeight.Bold).fontColor(Color.White);
        Text(this.today.photos[this.selectedPhotoIndex].takenAt).fontSize(12).fontColor('#F2E8E3');
        Row({ space: 8 }) { Button('上一张').layoutWeight(1).enabled(this.selectedPhotoIndex > 0).onClick(() => this.selectPhoto(this.selectedPhotoIndex - 1)); Button('下一张').layoutWeight(1).enabled(this.selectedPhotoIndex < this.today.photos.length - 1).onClick(() => this.selectPhoto(this.selectedPhotoIndex + 1)); }.width('100%');
        Row({ space: 8 }) { Button('下载').layoutWeight(1).onClick(() => this.downloadSelectedPhoto()); Button('删除').layoutWeight(1).enabled(Boolean(this.today.permissions['canDeletePhotos'])).backgroundColor('#A9554D').onClick(() => this.deleteSelectedPhoto()); }.width('100%');
      }.width('100%').height('100%').padding({ left: 18, right: 18, top: 20, bottom: 20 }).backgroundColor('#2B211ECC').accessibilityGroup(true);
    }
  }

  @Builder
  private bottomNavigation(): void {
    Row() {
      ForEach(NATIVE_TABS, (tab: NativeTab) => {
        Button(tabLabel(tab))
          .layoutWeight(1)
          .height(this.largeText ? 58 : 52)
          .fontSize(this.largeText ? 14 : 11)
          .fontWeight(this.activeTab === tab ? FontWeight.Bold : FontWeight.Normal)
          .fontColor(this.activeTab === tab ? '#4E3B35' : '#9A8C83')
          .backgroundColor(this.activeTab === tab ? '#FFE8DE' : Color.Transparent)
          .borderRadius(18)
          .onClick(() => this.selectTab(tab));
      }, (tab: NativeTab) => tab);
    }
    .width('100%')
    .padding({ left: 8, right: 8, top: 8, bottom: 8 })
    .backgroundColor('#FFFCF8')
    .borderRadius(28)
    .shadow({ radius: 18, color: '#3E302518', offsetY: 7, offsetX: 0 });
  }

  @Builder
  private readyView(): void {
    Stack() {
      Column() {
        Scroll() {
          this.nativeSurface();
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .padding({ left: 18, right: 18 });
        this.bottomNavigation();
      }
      .width('100%')
      .height('100%');
      if (this.showFamilyPanel) {
        Column() {
          Blank().layoutWeight(1).onClick(() => this.showFamilyPanel = false);
          this.familyPanel();
        }
        .width('100%')
        .height('100%')
        .backgroundColor('#4E3B3540');
      }
      if (this.selectedRecordType !== null) {
        Column() {
          Blank().layoutWeight(1).onClick(() => this.closeRecord());
          this.recordSheet();
        }.width('100%').height('100%').backgroundColor('#4E3B3540');
      }
      if (this.showPhotoViewer) this.photoViewer();
      if (this.feedbackMessage.length > 0) {
        Row({ space: 8 }) {
          Text(this.feedbackMessage).fontSize(this.largeText ? 15 : 12).fontColor(Color.White).layoutWeight(1);
          if (this.undoEventId.length > 0) Button('撤销').height(34).backgroundColor('#FFF8F3').fontColor('#8F5148').onClick(() => this.undoRecord());
          Button('关闭').height(34).backgroundColor(Color.Transparent).fontColor(Color.White).onClick(() => this.feedbackMessage = '');
        }.position({ x: 16, y: this.topAvoidHeight + 12 }).width('92%').padding(12).backgroundColor('#4E3B35').borderRadius(16).accessibilityLevel('yes');
      }
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private errorView(): void {
    Column({ space: 14 }) {
      Text('暂时无法连接共享业务源').fontSize(this.largeText ? 25 : 21).fontWeight(FontWeight.Bold).fontColor('#4E3B35');
      Text(this.statusMessage).fontSize(this.largeText ? 17 : 14).fontColor('#806E68').textAlign(TextAlign.Center);
      Button('重试').width(140).height(46).fontColor(Color.White).backgroundColor('#D98372').borderRadius(23).onClick(() => this.loadResource());
      Text('不会创建离线照护事实；恢复网络后可重新读取。').fontSize(this.largeText ? 15 : 12).fontColor('#A28B81');
    }
    .width('100%')
    .height('100%')
    .padding({ left: 30, right: 30 })
    .justifyContent(FlexAlign.Center);
  }

  build(): void {
    Stack() {
      if (this.phase === 'loading') this.loadingView();
      if (this.phase === 'login') this.loginView();
      if (this.phase === 'household') this.householdView();
      if (this.phase === 'ready') this.readyView();
      if (this.phase === 'error') this.errorView();
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.topAvoidHeight, bottom: this.bottomAvoidHeight })
    .backgroundColor('#FFF9F0');
  }
}
