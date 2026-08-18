import { common } from '@kit.AbilityKit';
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

type NativePhase = 'loading' | 'login' | 'household' | 'ready' | 'error';
type LoginMode = 'login' | 'register' | 'reset';

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
  @StorageProp('topAvoidHeight') private topAvoidHeight: number = 0;
  @StorageProp('bottomAvoidHeight') private bottomAvoidHeight: number = 0;
  @StorageProp('nativeAuthCallback') private nativeAuthCallback: string = '';
  private handledNativeAuthCallback: string = '';

  aboutToAppear(): void {
    this.adapter = new NativeResourceAdapter(getContext(this) as common.UIAbilityContext);
    if (this.nativeAuthCallback.length === 0) this.loadResource();
    this.consumeNativeAuthCallback();
  }

  onPageShow(): void {
    this.consumeNativeAuthCallback();
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
  private nativeSurface(): void {
    Column() {
      Row() {
        Column() {
          Text(this.surfaceTitle()).fontSize(this.largeText ? 28 : 23).fontWeight(FontWeight.Bold).fontColor('#4E3B35');
          Text(this.resource?.household?.baby?.nickname || '当前宝宝').fontSize(this.largeText ? 16 : 13).fontColor('#806E68').margin({ top: 4 });
        }.alignItems(HorizontalAlign.Start).layoutWeight(1);
        Button('家庭').height(38).backgroundColor('#FFF1EB').fontColor('#9A665C').borderRadius(19).onClick(() => this.showFamilyPanel = true);
      }.width('100%');
      if (this.staleCache) {
        Text(this.statusMessage).width('100%').fontSize(this.largeText ? 15 : 12).fontColor('#8A6742').backgroundColor('#FFF3D8').borderRadius(12).padding(10).margin({ top: 14 });
      }
      Column() {
        Text(this.activeTab === 'ai' ? '奶爸 AI 原生入口已就绪' : '原生业务表面已就绪')
          .fontSize(this.largeText ? 22 : 18)
          .fontWeight(FontWeight.Bold)
          .fontColor('#4E3B35');
        Text(this.surfaceDetail())
          .fontSize(this.largeText ? 16 : 13)
          .fontColor('#806E68')
          .textAlign(TextAlign.Center)
          .margin({ top: 10 });
        Text(`共享合同 ${this.resource?.contractVersion || '未知'} · ${this.resource?.dataTimezone || '未知时区'}`)
          .fontSize(this.largeText ? 14 : 11)
          .fontColor('#A28B81')
          .margin({ top: 16 });
        Button(this.selectedRoute.endsWith('.root') ? '打开此标签详情栈' : '返回此标签根页面')
          .height(44)
          .margin({ top: 20 })
          .onClick(() => {
            if (this.selectedRoute.endsWith('.root')) this.openSurfaceDetail(`${this.activeTab}.details`);
            else { this.navigation.repeat(this.activeTab); this.syncNavigation(); }
          });
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 30, bottom: 30 })
      .margin({ top: 20 })
      .backgroundColor('#FFFCF8')
      .borderRadius(22);
      Row({ space: 8 }) {
        Button('重新读取').layoutWeight(1).height(42).onClick(() => this.loadResource());
        Button('大字').height(42).onClick(() => this.largeText = !this.largeText);
        Button(this.reducedMotion ? '动效已减' : '减少动效').height(42).onClick(() => this.reducedMotion = !this.reducedMotion);
      }.margin({ top: 18 });
    }
    .width('100%');
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
