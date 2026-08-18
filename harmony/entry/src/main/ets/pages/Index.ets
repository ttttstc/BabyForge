import { common } from '@kit.AbilityKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo, picker } from '@kit.CoreFileKit';
import { image } from '@kit.ImageKit';
import { camera, cameraPicker } from '@kit.CameraKit';
import vibrator from '@ohos.vibrator';
import util from '@ohos.util';
import inputMethod from '@ohos.inputMethod';
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
import {
  NativeAiAttachment,
  NativeAiBootstrap,
  NativeAiCapability,
  NativeAiMessage,
  NativeAiSession,
  NativeAiStatus
} from '../data/NativeAiContract';

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

interface NativeAiContextCard {
  kind: string;
  title: string;
  description: string;
  sourceIds: Array<string>;
}

interface NativeAiReportFactPayload {
  reportName: string;
  fields: Object;
  uncertainties: Object;
  extractedAt: string;
}

interface NativeAiFactActor {
  id: string;
  displayName: string;
}

interface NativeAiFactEvent {
  id: string;
  babyId: string;
  kind: string;
  category: string;
  occurredAt: string;
  recordedAt: string;
  actor: NativeAiFactActor;
  source: string;
  payload: NativeAiReportFactPayload;
  status: string;
  version: number;
}

interface NativeAiReportDraft {
  status: string;
  title: string;
  summary: string;
  event: NativeAiFactEvent;
  needsConfirmation: boolean;
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
  @State private aiModel: NativeAiBootstrap | null = null;
  @State private aiConversationId: string = '';
  @State private aiMessages: Array<NativeAiMessage> = [];
  @State private aiInput: string = '';
  @State private aiStatus: NativeAiStatus = 'idle';
  @State private aiError: string = '';
  @State private aiArtifact: Object | null = null;
  @State private aiArtifactSkill: string = '';
  @State private aiSources: Array<Object> = [];
  @State private aiContext: NativeAiContextCard | null = null;
  @State private aiContextVisible: boolean = false;
  @State private aiAttachment: NativeAiAttachment | null = null;
  @State private aiDraft: Object | null = null;
  @State private aiDraftId: string = '';
  @State private aiDraftValue: string = '';
  @State private aiSelectedSkillId: string = '';
  @State private aiSessionsExpanded: boolean = false;
  private aiStopRequested: boolean = false;
  private aiCancelable: boolean = false;
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
    if (this.phase === 'ready') {
      this.loadToday();
      this.loadAi();
    }
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

  private nativeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  }

  private aiWelcomeMessage(): NativeAiMessage {
    return {
      id: this.nativeId('ai-welcome'),
      role: 'assistant',
      text: '嗨，我是奶爸 AI。你可以问宝宝当前阶段、描述刚刚发生的事，或从下面的能力入口开始。缺失事实不会被当成 0，正式记录必须由你确认。',
      skillId: null,
      createdAt: new Date().toISOString(),
      artifact: null,
      sources: []
    };
  }

  private aiStatusText(): string {
    if (this.aiStatus === 'loading') return '正在恢复最近会话…';
    if (this.aiStatus === 'sending') return '正在发送…';
    if (this.aiStatus === 'generating') return '正在生成，安全规则仍由服务端控制…';
    if (this.aiStatus === 'success') return '已完成';
    if (this.aiStatus === 'fallback') return '已切换到受限结果';
    if (this.aiStatus === 'tool_failed') return '工具或模型暂时失败';
    if (this.aiStatus === 'stopped') return '已停止生成';
    if (this.aiStatus === 'offline') return '当前离线';
    if (this.aiStatus === 'read_only') return '只读账号';
    if (this.aiStatus === 'draft_pending') return '草稿待确认';
    if (this.aiStatus === 'draft_expired') return '草稿已过期';
    if (this.aiStatus === 'draft_confirmed') return '事实已确认写入';
    if (this.aiStatus === 'draft_discarded') return '草稿已丢弃';
    return '可开始对话';
  }

  private async loadAi(): Promise<void> {
    if (this.adapter === null || this.resource?.household?.baby === null) return;
    this.aiStatus = 'loading';
    this.aiError = '';
    try {
      const model = await this.adapter.aiBootstrap();
      this.aiModel = model;
      this.aiConversationId = model.activeSession?.id || '';
      this.aiMessages = model.activeSession && model.activeSession.messages.length > 0
        ? model.activeSession.messages
        : [this.aiWelcomeMessage()];
      this.aiStatus = 'idle';
    } catch (error) {
      this.aiStatus = error instanceof NativeTransportError && error.code === 'NETWORK_UNAVAILABLE' ? 'offline' : 'tool_failed';
      this.aiError = error instanceof Error ? error.message : '奶爸 AI 暂时无法读取，请重试。';
    }
  }

  private async selectAiSession(session: NativeAiSession): Promise<void> {
    if (this.adapter === null || this.busy) return;
    this.aiStatus = 'loading';
    this.aiError = '';
    try {
      const model = await this.adapter.aiBootstrap(session.id);
      this.aiModel = model;
      this.aiConversationId = model.activeSession?.id || session.id;
      this.aiMessages = model.activeSession && model.activeSession.messages.length > 0
        ? model.activeSession.messages
        : [this.aiWelcomeMessage()];
      this.aiArtifact = null;
      this.aiDraft = null;
      this.aiDraftId = '';
      this.aiStatus = 'idle';
    } catch (error) {
      this.aiStatus = error instanceof NativeTransportError && error.code === 'NETWORK_UNAVAILABLE' ? 'offline' : 'tool_failed';
      this.aiError = error instanceof Error ? error.message : '会话暂时无法读取，请重试。';
    }
  }

  private newAiConversation(): void {
    this.aiConversationId = '';
    this.aiSelectedSkillId = '';
    this.aiMessages = [this.aiWelcomeMessage()];
    this.aiInput = '';
    this.navigation.clearTemporaryInput('ai');
    this.aiArtifact = null;
    this.aiArtifactSkill = '';
    this.aiSources = [];
    this.aiDraft = null;
    this.aiDraftId = '';
    this.aiError = '';
    this.aiStatus = 'idle';
  }

  private setAiInput(value: string): void {
    this.aiInput = value;
    this.navigation.setTemporaryInput('ai', value);
  }

  private aiContextForTab(tab: NativeTab): NativeAiContextCard {
    const sourceIds = this.today === null ? [] : this.today.recentFacts.slice(0, 6).map((fact: NativeTodayFact) => fact.id);
    if (tab === 'today') return { kind: tab, title: '来自今天', description: `${this.selectedDay || '今天'} 的摘要、事项和最新记录将作为可移除上下文。不会自动发送。`, sourceIds };
    if (tab === 'record') return { kind: tab, title: '来自记录', description: '会话可以引用当前已确认事实和时间线；草稿不会自动写入。', sourceIds };
    if (tab === 'growth') return { kind: tab, title: '来自成长', description: '会话可以引用成长测量、标准解释和限制；不会重新计算规则。', sourceIds };
    return { kind: tab, title: '来自探索', description: '会话可以引用审核知识、疾病主题或器官内容；不会把知识当成当前宝宝诊断。', sourceIds };
  }

  private async runAiCapability(capability: NativeAiCapability): Promise<void> {
    const adapter = this.adapter;
    const baby = this.resource?.household?.baby || null;
    if (adapter === null || baby === null || this.busy) return;
    this.aiCancelable = false;
    this.aiSelectedSkillId = '';
    const chatOnly = ['authority_knowledge_retriever', 'stage_parenting_qa', 'disease_explainer', 'triage_and_preassessment'];
    if (chatOnly.includes(capability.id)) {
      this.aiSelectedSkillId = capability.id;
      if (capability.id === 'triage_and_preassessment') this.setAiInput(this.aiInput.length > 0 ? this.aiInput : '我担心宝宝现在不舒服，请先问我最关键的一件事');
      else this.setAiInput(this.aiInput.length > 0 ? this.aiInput : `请使用${capability.label}回答我的问题`);
      this.aiError = '入口已准备好；请核对输入后再发送，不会自动发送。';
      return;
    }
    if (capability.id === 'care_event_quick_logger') {
      this.aiSelectedSkillId = capability.id;
      this.setAiInput(this.aiInput.length > 0 ? this.aiInput : '帮我记录刚刚发生的事实');
      this.aiError = '记录入口已准备好；请补充具体事实并发送，不会自动写入。';
      return;
    }
    const input: Record<string, Object | null> = {};
    if (capability.id === 'medical_report_interpreter') {
      this.aiSelectedSkillId = capability.id;
      this.setAiInput('请先选择报告或粘贴报告文本');
      this.aiError = '报告需先选择文件或粘贴文本，再进行识别。原始文件不会进入报告或分享。';
      return;
    }
    if (capability.id === 'authority_knowledge_retriever' || capability.id === 'stage_parenting_qa' || capability.id === 'disease_explainer') input['query'] = this.aiInput;
    if (capability.id === 'visit_brief_generator' && this.aiInput.length > 0) input['questions'] = [this.aiInput] as Object;
    this.busy = true;
    this.aiStatus = 'sending';
    this.aiError = '';
    try {
      const payload = await adapter.aiCapability(capability.id, String(baby.id), input as Object);
      const result = payload as Record<string, Object>;
      this.aiArtifact = result['data'] || null;
      this.aiArtifactSkill = capability.id;
      const source = result['sources'];
      this.aiSources = source !== null && typeof source === 'object' ? [source] : [];
      const data = result['data'];
      if (capability.id === 'care_event_quick_logger' && data !== null && typeof data === 'object' && String((data as Record<string, Object>)['status'] || '') === 'draft_ready') {
        await this.prepareAiDraft(data as Object);
      } else {
        this.aiStatus = 'success';
      }
    } catch (error) {
      this.aiStatus = error instanceof NativeTransportError && error.code === 'NETWORK_UNAVAILABLE' ? 'offline' : 'tool_failed';
      this.aiError = error instanceof Error ? error.message : '结构化能力暂时失败，请重试。';
    } finally {
      this.busy = false;
    }
  }

  private async prepareAiDraft(value: Object): Promise<void> {
    this.aiDraft = value;
    const draft = value as Record<string, Object>;
    const event = draft['event'];
    this.aiDraftValue = this.draftValue(event);
    if (this.resource?.permissions.readOnly === true) {
      this.aiStatus = 'read_only';
      return;
    }
    if (this.adapter === null || event === null || typeof event !== 'object') {
      this.aiStatus = 'tool_failed';
      this.aiError = '记录草稿缺少事实事件，不能确认。';
      return;
    }
    try {
      const saved = await this.adapter.aiCreateDraft(event as Object, String((event as Record<string, Object>)['category'] || 'care_event'));
      const savedRecord = saved as Record<string, Object>;
      this.aiDraftId = String(savedRecord['draftId'] || '');
      this.aiStatus = this.aiDraftId.length > 0 ? 'draft_pending' : 'tool_failed';
      if (this.aiDraftId.length === 0) this.aiError = '服务端没有返回草稿编号，未显示确认成功。';
    } catch (error) {
      this.aiStatus = 'tool_failed';
      this.aiError = error instanceof Error ? error.message : '记录草稿创建失败。';
    }
  }

  private draftValue(value: Object | null): string {
    if (value === null || typeof value !== 'object') return '';
    const event = value as Record<string, Object>;
    const payload = event['payload'];
    if (payload === null || typeof payload !== 'object') return '';
    const fields = payload as Record<string, Object>;
    if (fields['amountMl'] !== undefined && fields['amountMl'] !== null) return String(fields['amountMl']);
    if (fields['value'] !== undefined && fields['value'] !== null) return String(fields['value']);
    if (fields['note'] !== undefined && fields['note'] !== null) return String(fields['note']);
    if (fields['symptomNotes'] !== undefined && fields['symptomNotes'] !== null) return String(fields['symptomNotes']);
    return '';
  }

  private updateAiDraftValue(value: string): void {
    this.aiDraftValue = value;
    if (this.aiDraft === null || typeof this.aiDraft !== 'object') return;
    const draft = this.aiDraft as Record<string, Object>;
    const event = draft['event'];
    if (event === null || typeof event !== 'object') return;
    const eventRecord = event as Record<string, Object>;
    const payload = eventRecord['payload'];
    if (payload === null || typeof payload !== 'object') return;
    const payloadRecord = payload as Record<string, Object | null>;
    const category = String(eventRecord['category'] || '');
    if (category === 'bottle_feeding') payloadRecord['amountMl'] = value.length > 0 ? Number(value) : null;
    else if (category === 'temperature' || category === 'growth_measurement') payloadRecord['value'] = value.length > 0 ? Number(value) : null;
    else payloadRecord['note'] = value;
    this.aiDraft = draft;
  }

  private aiReportFields(): Array<Object> {
    if (this.aiDraft === null || typeof this.aiDraft !== 'object') return [];
    const draft = this.aiDraft as Record<string, Object>;
    const event = draft['event'];
    if (event === null || typeof event !== 'object') return [];
    const payload = (event as Record<string, Object>)['payload'];
    if (payload === null || typeof payload !== 'object') return [];
    const fields = (payload as Record<string, Object>)['fields'];
    return Array.isArray(fields) ? fields as Array<Object> : [];
  }

  private aiReportFieldValue(index: number, key: string): string {
    const fields = this.aiReportFields();
    if (index < 0 || index >= fields.length) return '';
    const field = fields[index];
    if (field === null || typeof field !== 'object') return '';
    return String((field as Record<string, Object>)[key] || '');
  }

  private updateAiReportField(index: number, key: string, value: string): void {
    if (this.aiDraft === null || typeof this.aiDraft !== 'object') return;
    const draft = this.aiDraft as Record<string, Object>;
    const event = draft['event'];
    if (event === null || typeof event !== 'object') return;
    const eventRecord = event as Record<string, Object>;
    const payload = eventRecord['payload'];
    if (payload === null || typeof payload !== 'object') return;
    const fields = (payload as Record<string, Object>)['fields'];
    if (!Array.isArray(fields) || index < 0 || index >= fields.length) return;
    const reportFields = fields as Array<Object>;
    const field = reportFields[index];
    if (field === null || typeof field !== 'object') return;
    (field as Record<string, Object>)[key] = value;
    this.aiDraft = draft;
  }

  private async confirmAiDraft(): Promise<void> {
    if (this.adapter === null || this.aiDraft === null || this.aiDraftId.length === 0 || this.busy) return;
    if (this.resource?.permissions.readOnly === true) {
      this.aiStatus = 'read_only';
      this.aiError = '当前账号只读，不能确认写入事实。';
      return;
    }
    const draft = this.aiDraft as Record<string, Object>;
    const event = draft['event'];
    if (event === null || typeof event !== 'object') return;
    this.busy = true;
    try {
      const saved = await this.adapter.aiConfirmDraft(this.aiDraftId, event as Object);
      const savedEvent = (saved as Record<string, Object>)['event'];
      draft['status'] = 'confirmed';
      if (savedEvent !== null && typeof savedEvent === 'object') draft['event'] = savedEvent;
      this.aiDraft = draft;
      this.aiStatus = 'draft_confirmed';
      this.aiError = '事实已由服务端确认写入；它仍是观察事实，不是诊断。';
      await this.loadToday();
    } catch (error) {
      this.aiStatus = error instanceof NativeTransportError && error.status === 409 ? 'draft_expired' : 'tool_failed';
      this.aiError = error instanceof Error ? error.message : '事实保存失败，请重试。';
    } finally {
      this.busy = false;
    }
  }

  private async discardAiDraft(): Promise<void> {
    if (this.adapter !== null && this.aiDraftId.length > 0) {
      try { await this.adapter.aiDiscardDraft(this.aiDraftId); } catch { /* 草稿会自动过期 */ }
    }
    this.aiDraft = null;
    this.aiDraftId = '';
    this.aiStatus = 'draft_discarded';
    this.aiError = '草稿已丢弃，未写入正式事实。';
  }

  private async sendAiMessage(): Promise<void> {
    const message = this.aiInput.trim();
    const adapter = this.adapter;
    const baby = this.resource?.household?.baby || null;
    if (adapter === null || baby === null || message.length === 0 || this.busy) return;
    this.setAiInput('');
    this.aiMessages = this.aiMessages.concat([{
      id: this.nativeId('ai-user'), role: 'user', text: message, skillId: null, createdAt: new Date().toISOString(), artifact: null, sources: []
    }]);
    this.aiArtifact = null;
    this.aiArtifactSkill = '';
    this.aiSources = [];
    this.aiError = '';
    this.aiStopRequested = false;
    const selectedSkillId = this.aiSelectedSkillId;
    this.aiSelectedSkillId = '';
    this.aiCancelable = selectedSkillId !== 'care_event_quick_logger' && selectedSkillId !== 'medical_report_interpreter';
    this.busy = true;
    this.aiStatus = 'generating';
    try {
      if (selectedSkillId === 'care_event_quick_logger') {
        const messageInput: Record<string, Object> = {};
        messageInput['message'] = message;
        const payload = await adapter.aiCapability(selectedSkillId, String(baby.id), messageInput as Object);
        if (this.aiStopRequested) return;
        const result = payload as Record<string, Object>;
        const data = result['data'];
        this.aiArtifact = data || null;
        this.aiArtifactSkill = selectedSkillId;
        if (data !== null && typeof data === 'object' && String((data as Record<string, Object>)['status'] || '') === 'draft_ready') {
          await this.prepareAiDraft(data as Object);
        } else {
          this.aiStatus = 'success';
          const dataRecord = data !== null && typeof data === 'object' ? data as Record<string, Object> : null;
          this.aiError = dataRecord === null ? '还需要一条具体事实才能准备草稿。' : String(dataRecord['question'] || dataRecord['message'] || '还需要一条具体事实才能准备草稿。');
        }
        return;
      }
      if (selectedSkillId === 'medical_report_interpreter') {
        const reportInput: Record<string, Object> = {};
        reportInput['text'] = message;
        reportInput['name'] = '粘贴文本报告';
        const payload = await adapter.aiCapability(selectedSkillId, String(baby.id), reportInput as Object);
        const result = payload as Record<string, Object>;
        const data = result['data'];
        if (this.aiStopRequested) return;
        if (data === null || typeof data !== 'object') throw new Error('没有收到可核对的报告字段。');
        this.aiArtifact = data;
        this.aiArtifactSkill = selectedSkillId;
        await this.prepareAiReportDraft(data as Object, '粘贴文本报告');
        return;
      }
      const reply = await adapter.aiChat(message, String(baby.id), this.aiConversationId, selectedSkillId);
      if (this.aiStopRequested) return;
      if (reply.conversationId !== null) this.aiConversationId = reply.conversationId;
      this.aiSources = reply.sources;
      if (reply.decision !== null) {
        this.aiArtifact = reply.decision;
        this.aiArtifactSkill = selectedSkillId.length > 0 ? selectedSkillId : 'triage_and_preassessment';
      }
      if (reply.text.length > 0) this.aiMessages = this.aiMessages.concat([{
        id: this.nativeId('ai-assistant'), role: 'assistant', text: reply.text, skillId: null, createdAt: new Date().toISOString(), artifact: reply.artifact !== null ? reply.artifact : reply.decision, sources: reply.sources
      }]);
      this.aiStatus = reply.status === 'fallback' ? 'fallback' : reply.status === 'tool_failed' ? 'tool_failed' : 'success';
      if (reply.reason !== null && reply.status !== 'success') this.aiError = `服务端状态：${reply.reason}。可保留输入后重试。`;
    } catch (error) {
      if (this.aiStopRequested) return;
      this.aiStatus = error instanceof NativeTransportError && error.code === 'NETWORK_UNAVAILABLE' ? 'offline' : 'tool_failed';
      this.aiError = error instanceof Error ? error.message : 'AI 请求失败，输入仍保留在会话中。';
      this.setAiInput(message);
    } finally {
      this.busy = false;
      this.aiCancelable = false;
    }
  }

  private stopAi(): void {
    if (!this.busy || !this.aiCancelable || this.adapter === null) return;
    this.aiStopRequested = true;
    this.adapter.cancelAiChat();
    this.aiStatus = 'stopped';
    this.aiError = '已停止生成；没有部分正式事实被写入。';
    this.busy = false;
    this.aiCancelable = false;
  }

  private async openSystemVoiceInput(): Promise<void> {
    try {
      await inputMethod.getController().showTextInput();
      this.aiError = '系统键盘已打开；可使用键盘语音入口输入，内容仍需你确认后发送。';
    } catch {
      this.aiError = '系统语音入口暂不可用，请使用文字输入。';
    }
  }

  private attachmentMime(uri: string): string {
    const lower = uri.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.txt')) return 'text/plain';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  private async chooseAiPhoto(): Promise<void> {
    if (this.busy) return;
    try {
      const result = await new photoAccessHelper.PhotoViewPicker().select({ MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE, maxSelectNumber: 1 });
      if (result.photoUris.length === 0) return;
      this.aiAttachment = {
        kind: 'photo',
        name: '宝宝照片',
        uri: result.photoUris[0],
        mimeType: this.attachmentMime(result.photoUris[0]),
        purpose: '仅用于本次奶爸 AI 识别，不会自动进入相册、事实或分享材料。',
        explicitSendRequired: true,
        confirmed: false
      };
      this.aiError = '照片已显示缩略图；只有点击“再次发送并识别”后才会发送给已配置的 AI 服务商。';
    } catch {
      this.aiError = '照片选择未完成；照片未发送。';
    }
  }

  private async chooseAiReport(): Promise<void> {
    if (this.busy) return;
    try {
      const pickerInstance = new picker.DocumentViewPicker(getContext(this));
      const result = await pickerInstance.select({ fileSuffixFilters: ['.txt', '.pdf', '.jpg', '.jpeg', '.png', '.webp'], maxSelectNumber: 1 });
      if (result.length === 0) return;
      const uri = result[0];
      this.aiAttachment = {
        kind: 'report',
        name: uri.split('/').pop() || '报告文件',
        uri,
        mimeType: this.attachmentMime(uri),
        purpose: '仅提取报告中可核对字段；原始文件不会进入报告或分享材料。',
        explicitSendRequired: true,
        confirmed: false
      };
      this.aiError = '报告已选择；请先查看用途说明，再点击“再次发送并识别”。';
    } catch {
      this.aiError = '报告选择未完成；原始文件未发送。';
    }
  }

  private clearAiAttachment(): void {
    this.aiAttachment = null;
    this.aiError = '附件已移除，未发送。';
  }

  private async readAiFile(uri: string): Promise<ArrayBuffer> {
    const stat = await fileIo.stat(uri);
    const size = Number(stat.size || 0);
    if (!Number.isFinite(size) || size <= 0 || size > 6 * 1024 * 1024) throw new Error('附件需小于约 6 MB。');
    const opened = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    const buffer = new ArrayBuffer(size);
    try {
      const count = await fileIo.read(opened.fd, buffer);
      return buffer.slice(0, Number(count));
    } finally {
      await fileIo.close(opened);
    }
  }

  private aiDataUrl(buffer: ArrayBuffer, mimeType: string): string {
    const encoded = new util.Base64Helper().encodeToStringSync(new Uint8Array(buffer));
    return `data:${mimeType};base64,${encoded}`;
  }

  private reportFactEvent(report: Object, name: string): Object {
    const reportRecord = report as Record<string, Object>;
    const payload: NativeAiReportFactPayload = {
      reportName: String(reportRecord['reportName'] || name),
      fields: (reportRecord['fields'] || []) as Object,
      uncertainties: (reportRecord['uncertainties'] || []) as Object,
      extractedAt: String(reportRecord['extractedAt'] || new Date().toISOString())
    };
    const recorder = this.today === null ? null : this.today.recorder;
    const actor: NativeAiFactActor = {
      id: recorder === null ? '' : String(recorder['id'] || ''),
      displayName: recorder === null ? '家庭成员' : String(recorder['displayName'] || '家庭成员')
    };
    const event: NativeAiFactEvent = {
      id: this.nativeId('ai-report'),
      babyId: String(this.resource?.household?.baby?.id || ''),
      kind: 'measurement',
      category: 'medical_report_observation',
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      actor,
      source: 'clinical_record',
      payload,
      status: 'active',
      version: 1
    };
    return event as Object;
  }

  private async prepareAiReportDraft(report: Object, name: string): Promise<void> {
    const reportRecord = report as Record<string, Object>;
    const fields = reportRecord['fields'];
    if (!Array.isArray(fields) || fields.length === 0) {
      this.aiStatus = 'success';
      this.aiError = String((reportRecord['uncertainties'] as Object) || '没有识别出可核对的报告字段。');
      return;
    }
    const event = this.reportFactEvent(report, name) as NativeAiFactEvent;
    const draft: NativeAiReportDraft = {
      status: 'draft_ready',
      title: '报告字段事实',
      summary: `识别 ${fields.length} 个字段，确认后写入`,
      event,
      needsConfirmation: true
    };
    await this.prepareAiDraft(draft as Object);
  }

  private async sendAiAttachment(): Promise<void> {
    const attachment = this.aiAttachment;
    const adapter = this.adapter;
    const baby = this.resource?.household?.baby || null;
    if (adapter === null || baby === null || attachment === null || this.busy) return;
    this.aiSelectedSkillId = '';
    this.aiCancelable = false;
    attachment.confirmed = true;
    this.aiAttachment = attachment;
    this.aiError = '';
    this.busy = true;
    this.aiStatus = 'sending';
    this.aiMessages = this.aiMessages.concat([{
      id: this.nativeId('ai-attachment'),
      role: 'user',
      text: `已确认发送${attachment.kind === 'photo' ? '照片' : '报告'}：${attachment.name}`,
      skillId: 'medical_report_interpreter',
      createdAt: new Date().toISOString(),
      artifact: null,
      sources: []
    }]);
    try {
      const buffer = await this.readAiFile(attachment.uri);
      let payload: Object;
      if (attachment.mimeType === 'text/plain') {
        const text = util.TextDecoder.create('utf-8').decodeToString(new Uint8Array(buffer));
        const reportInput: Record<string, Object> = {};
        reportInput['text'] = text;
        reportInput['name'] = attachment.name;
        payload = await adapter.aiCapability('medical_report_interpreter', String(baby.id), reportInput as Object);
      } else {
        payload = await adapter.aiReport(String(baby.id), attachment.name, attachment.mimeType, '', this.aiDataUrl(buffer, attachment.mimeType));
      }
      const response = payload as Record<string, Object>;
      const report = response['report'] || response['data'];
      if (report === null || typeof report !== 'object') throw new Error('没有收到可核对的报告字段。');
      this.aiArtifact = report;
      this.aiArtifactSkill = 'medical_report_interpreter';
      await this.prepareAiReportDraft(report as Object, attachment.name);
      this.aiAttachment = null;
    } catch (error) {
      this.aiStatus = error instanceof NativeTransportError && error.code === 'NETWORK_UNAVAILABLE' ? 'offline' : 'tool_failed';
      this.aiError = error instanceof Error ? error.message : '报告识别失败；原始文件未保存。';
    } finally {
      this.busy = false;
    }
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
    const previousTab = this.activeTab;
    if (this.activeTab === tab) this.navigation.repeat(tab);
    if (tab === 'ai' && previousTab !== 'ai') {
      this.aiContext = this.aiContextForTab(previousTab);
      this.aiContextVisible = true;
      this.aiInput = this.navigation.state('ai').temporaryInput;
      if (this.aiModel === null) this.loadAi();
    }
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

  private aiDraftTitle(): string {
    if (this.aiDraft === null || typeof this.aiDraft !== 'object') return '事实草稿';
    return String((this.aiDraft as Record<string, Object>)['title'] || '事实草稿');
  }

  private aiDraftSummary(): string {
    if (this.aiDraft === null || typeof this.aiDraft !== 'object') return '';
    return String((this.aiDraft as Record<string, Object>)['summary'] || '请逐项核对后再确认。');
  }

  private aiDraftCategory(): string {
    if (this.aiDraft === null || typeof this.aiDraft !== 'object') return '';
    const event = (this.aiDraft as Record<string, Object>)['event'];
    return event !== null && typeof event === 'object' ? String((event as Record<string, Object>)['category'] || '') : '';
  }

  private aiArtifactPreview(): string {
    if (this.aiArtifact === null) return '';
    const text = JSON.stringify(this.aiArtifact);
    return text.length > 900 ? `${text.substring(0, 900)}…` : text;
  }

  private aiSourcePreview(source: Object): string {
    if (source === null || typeof source !== 'object') return '';
    const value = source as Record<string, Object>;
    return String(value['url'] || value['knowledgePackVersion'] || value['eventIds'] || '共享事实与审核规则');
  }

  @Builder
  private aiMessageCard(message: NativeAiMessage): void {
    Row({ space: 10 }) {
      if (message.role === 'assistant') Image($r('app.media.ai_baby_anchor')).width(40).height(40).objectFit(ImageFit.Contain).alt('奶爸 AI 小月龄宝宝陪伴形象');
      Column({ space: 5 }) {
        Text(message.role === 'assistant' ? '奶爸 AI' : '你').fontSize(this.largeText ? 14 : 11).fontColor('#A65E51');
        Text(message.text).fontSize(this.largeText ? 17 : 14).fontColor('#4E3B35').maxLines(12).textAlign(TextAlign.Start);
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
    }.width('100%').padding(12).backgroundColor(message.role === 'assistant' ? '#FFFCF8' : '#FFF1EB').borderRadius(16).accessibilityGroup(true);
  }

  @Builder
  private aiCapabilityEntry(capability: NativeAiCapability): void {
    Button() {
      Column({ space: 4 }) {
        Text(capability.label).fontSize(this.largeText ? 16 : 13).fontWeight(FontWeight.Bold).fontColor('#4E3B35');
        Text(capability.boundary).fontSize(this.largeText ? 13 : 10).fontColor('#806E68').maxLines(2).textAlign(TextAlign.Start);
      }.width('100%').alignItems(HorizontalAlign.Start).padding(10);
    }.width('100%').height(this.largeText ? 78 : 66).backgroundColor('#FFF8F3').borderRadius(14).onClick(() => this.runAiCapability(capability)).accessibilityText(`打开${capability.label}`);
  }

  @Builder
  private aiSurface(): void {
    Column({ space: 14 }) {
      this.nativeHeader('奶爸 AI', `${String(this.today?.baby['nickname'] || this.resource?.household?.baby?.nickname || '宝宝')} · ${this.aiStatusText()}`);
      Row({ space: 8 }) {
        Button('新对话').layoutWeight(1).height(38).backgroundColor('#FFE8DE').onClick(() => this.newAiConversation());
        Button(this.aiSessionsExpanded ? '收起会话' : '最近会话').layoutWeight(1).height(38).onClick(() => this.aiSessionsExpanded = !this.aiSessionsExpanded);
      }.width('100%');
      if (this.aiContextVisible && this.aiContext !== null) {
        Row({ space: 8 }) {
          Column({ space: 4 }) { Text(this.aiContext.title).fontSize(this.largeText ? 16 : 13).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); Text(this.aiContext.description).fontSize(this.largeText ? 14 : 11).fontColor('#806E68').maxLines(3).textAlign(TextAlign.Start); }.alignItems(HorizontalAlign.Start).layoutWeight(1);
          Button('移除').height(32).fontSize(11).backgroundColor(Color.Transparent).fontColor('#A65E51').onClick(() => this.aiContextVisible = false);
        }.width('100%').padding(12).backgroundColor('#F2EEFA').borderRadius(14).accessibilityGroup(true);
      }
      if (this.aiModel === null) {
        Column({ space: 10 }) { LoadingProgress().width(28).height(28); Text(this.aiStatusText()).fontSize(this.largeText ? 16 : 13).fontColor('#806E68'); }.width('100%').padding(28);
      } else {
        Column({ space: 8 }) {
          Row() { Text('能力入口').fontSize(this.largeText ? 20 : 17).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Text('来自共享注册表').fontSize(11).fontColor('#7A9A80'); }
          ForEach(this.aiModel.capabilities, (capability: NativeAiCapability) => { this.aiCapabilityEntry(capability); }, (capability: NativeAiCapability) => capability.id);
        }.width('100%').padding(14).backgroundColor('#FFFCF8').borderRadius(20);
        if (this.aiSessionsExpanded) {
          Column({ space: 7 }) {
            Text('最近会话').fontSize(this.largeText ? 20 : 17).fontWeight(FontWeight.Bold).fontColor('#4E3B35').width('100%');
            if (this.aiModel.sessions.length === 0) Text('还没有可续接的云端会话；新对话会在首次发送后建立。').fontSize(12).fontColor('#806E68').width('100%');
            ForEach(this.aiModel.sessions.slice(0, 8), (session: NativeAiSession) => {
              Button() { Column({ space: 3 }) { Text(session.title).fontSize(this.largeText ? 16 : 13).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); Text(session.preview || '尚无消息').fontSize(11).fontColor('#806E68').maxLines(2).textAlign(TextAlign.Start); }.width('100%').alignItems(HorizontalAlign.Start).padding(10); }.width('100%').backgroundColor(session.id === this.aiConversationId ? '#FFE8DE' : '#FFF8F3').borderRadius(13).onClick(() => this.selectAiSession(session));
            }, (session: NativeAiSession) => session.id);
          }.width('100%').padding(14).backgroundColor('#FFFCF8').borderRadius(20);
        }
        Column({ space: 8 }) {
          Row() { Text('持续会话').fontSize(this.largeText ? 20 : 17).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Text(this.aiConversationId.length > 0 ? '默认续接最近会话' : '新会话').fontSize(11).fontColor('#806E68'); }
          Scroll() { Column({ space: 8 }) { ForEach(this.aiMessages, (message: NativeAiMessage) => { this.aiMessageCard(message); }, (message: NativeAiMessage) => message.id); } }.width('100%').height(this.largeText ? 360 : 290).scrollBar(BarState.Auto);
          if (this.aiArtifact !== null) {
            Column({ space: 7 }) { Row() { Text(this.aiArtifactSkill === 'medical_report_interpreter' ? '报告字段结果' : '结构化能力产物').fontSize(this.largeText ? 17 : 14).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Text('可核对').fontSize(11).fontColor('#7A9A80'); }; Text(this.aiArtifactPreview()).fontSize(this.largeText ? 13 : 11).fontColor('#806E68').maxLines(9).textAlign(TextAlign.Start); Text('结构化结果只用于解释或准备草稿，不会自动写入事实。').fontSize(11).fontColor('#806E68'); }.width('100%').padding(12).backgroundColor('#EEF5EC').borderRadius(14).accessibilityGroup(true);
          }
          if (this.aiDraft !== null) {
            Column({ space: 7 }) {
              Row() { Text(this.aiDraftTitle()).fontSize(this.largeText ? 17 : 14).fontWeight(FontWeight.Bold).fontColor('#4E3B35').layoutWeight(1); Text(this.aiStatus === 'draft_confirmed' ? '已确认' : this.aiStatus === 'read_only' ? '只读' : '待确认').fontSize(11).fontColor('#A65E51'); }
              Text(this.aiDraftSummary()).fontSize(12).fontColor('#806E68').width('100%');
              if (this.aiStatus !== 'draft_confirmed' && this.aiDraftCategory() === 'medical_report_observation') {
                ForEach(this.aiReportFields(), (_field: Object, index: number) => {
                  Column({ space: 4 }) {
                    Text(`报告字段 ${index + 1}`).fontSize(11).fontColor('#806E68');
                    TextInput({ text: this.aiReportFieldValue(index, 'name'), placeholder: '项目' }).width('100%').onChange((value: string) => this.updateAiReportField(index, 'name', value));
                    Row({ space: 6 }) {
                      TextInput({ text: this.aiReportFieldValue(index, 'value'), placeholder: '数值' }).layoutWeight(1).onChange((value: string) => this.updateAiReportField(index, 'value', value));
                      TextInput({ text: this.aiReportFieldValue(index, 'unit'), placeholder: '单位' }).layoutWeight(1).onChange((value: string) => this.updateAiReportField(index, 'unit', value));
                    }.width('100%');
                    TextInput({ text: this.aiReportFieldValue(index, 'referenceRange'), placeholder: '参考范围（可选）' }).width('100%').onChange((value: string) => this.updateAiReportField(index, 'referenceRange', value));
                  }.width('100%').padding(8).backgroundColor('#FFF9F0').borderRadius(10);
                }, (_field: Object, index: number) => String(index));
              } else if (this.aiStatus !== 'draft_confirmed') {
                TextInput({ text: this.aiDraftValue, placeholder: this.aiDraftCategory() === 'bottle_feeding' ? '实际摄入量' : '可编辑事实值或备注' }).width('100%').onChange((value: string) => this.updateAiDraftValue(value));
              }
              Text('只会保存已核对的观察事实；推荐量、诊断和紧急程度不会写入事实。').fontSize(11).fontColor('#806E68').width('100%');
              if (this.aiStatus === 'draft_confirmed') Text('这条记录已进入事实时间线，仍不是诊断。').fontSize(12).fontColor('#7A9A80').width('100%');
              else Row({ space: 8 }) { Button('先不保存').layoutWeight(1).height(40).onClick(() => this.discardAiDraft()); Button(this.resource?.permissions.readOnly === true ? '当前账号只读' : '确认并保存事实').layoutWeight(1).height(40).enabled(this.resource?.permissions.readOnly !== true && this.aiDraftId.length > 0 && !this.busy).fontColor(Color.White).backgroundColor('#D98372').onClick(() => this.confirmAiDraft()); }.width('100%');
            }.width('100%').padding(12).backgroundColor('#FFF3D8').borderRadius(14).accessibilityGroup(true);
          }
          if (this.aiSources.length > 0) {
            Column({ space: 5 }) { Text('来源与依据').fontSize(this.largeText ? 16 : 13).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); ForEach(this.aiSources, (source: Object, index: number) => { Text(this.aiSourcePreview(source)).fontSize(11).fontColor('#806E68').maxLines(2); }, (source: Object, index: number) => String(index)); }.width('100%').padding(12).backgroundColor('#F2EEFA').borderRadius(14);
          }
          if (this.aiAttachment !== null) {
            Row({ space: 8 }) {
              if (this.aiAttachment.kind === 'photo') Image(this.aiAttachment.uri).width(66).height(66).objectFit(ImageFit.Cover).alt('待发送照片缩略图');
              Column({ space: 4 }) { Text(this.aiAttachment.name).fontSize(13).fontWeight(FontWeight.Bold).fontColor('#4E3B35'); Text(this.aiAttachment.purpose).fontSize(11).fontColor('#806E68').maxLines(3).textAlign(TextAlign.Start); }.alignItems(HorizontalAlign.Start).layoutWeight(1);
              Button('移除').height(32).fontSize(11).onClick(() => this.clearAiAttachment());
            }.width('100%').padding(10).backgroundColor('#F2EEFA').borderRadius(14).accessibilityGroup(true);
            Button('再次发送并识别').width('100%').height(42).enabled(!this.busy).fontColor(Color.White).backgroundColor('#7A9A80').borderRadius(21).onClick(() => this.sendAiAttachment());
          }
          TextInput({ text: this.aiInput, placeholder: '输入问题、记录事实，或描述当前担心的事…' }).width('100%').height(this.largeText ? 86 : 68).onChange((value: string) => this.setAiInput(value)).onSubmit(() => this.sendAiMessage());
          Row({ space: 7 }) {
            Button('系统语音').layoutWeight(1).height(38).onClick(() => this.openSystemVoiceInput());
            Button('照片').layoutWeight(1).height(38).onClick(() => this.chooseAiPhoto());
            Button('报告').layoutWeight(1).height(38).onClick(() => this.chooseAiReport());
            if (this.busy && this.aiCancelable) Button('停止').layoutWeight(1).height(38).backgroundColor('#C36B63').fontColor(Color.White).onClick(() => this.stopAi());
            else if (this.busy) Button('处理中…').layoutWeight(1).height(38).enabled(false);
            else Button('发送').layoutWeight(1).height(38).enabled(this.aiInput.trim().length > 0).fontColor(Color.White).backgroundColor('#D98372').onClick(() => this.sendAiMessage());
          }.width('100%');
          Text(this.aiStatusText()).fontSize(11).fontColor(this.aiStatus === 'offline' || this.aiStatus === 'tool_failed' ? '#B85F53' : '#806E68').width('100%');
          if (this.aiError.length > 0) Text(this.aiError).fontSize(12).fontColor(this.aiStatus === 'offline' || this.aiStatus === 'tool_failed' ? '#B85F53' : '#806E68').width('100%').accessibilityLevel('yes');
          Text('照片不会自动发送；报告和分享默认排除原图。停止或失败不会产生部分正式事实。').fontSize(11).fontColor('#806E68').width('100%');
        }.width('100%').padding(14).backgroundColor('#FFFCF8').borderRadius(20);
      }
    }.width('100%');
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
    else if (this.activeTab === 'ai') this.aiSurface();
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
