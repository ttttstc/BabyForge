import { common } from '@kit.AbilityKit';
import { webview } from '@kit.ArkWeb';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import {
  handleWebBack,
  registerWebController,
  releaseWebController
} from '../common/ShellState';

const APP_URL: string = 'https://babyforge.bbroot.com/';
const TRUSTED_ORIGIN: string = 'https://babyforge.bbroot.com';

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  @State private isLoading: boolean = true;
  @State private hasError: boolean = false;
  @State private errorTitle: string = '无法连接 BabyForge';
  @State private errorDetail: string = '请检查网络连接后重试。';
  @StorageProp('topAvoidHeight') private topAvoidHeight: number = 0;
  @StorageProp('bottomAvoidHeight') private bottomAvoidHeight: number = 0;

  aboutToAppear(): void {
    registerWebController(this.controller);
  }

  aboutToDisappear(): void {
    releaseWebController(this.controller);
  }

  onBackPress(): boolean {
    return handleWebBack();
  }

  private isTrustedMainFrame(url: string): boolean {
    return url === TRUSTED_ORIGIN || url.startsWith(`${TRUSTED_ORIGIN}/`)
      || url.startsWith(`${TRUSTED_ORIGIN}?`) || url.startsWith(`${TRUSTED_ORIGIN}#`);
  }

  private showError(title: string, detail: string): void {
    this.isLoading = false;
    this.hasError = true;
    this.errorTitle = title;
    this.errorDetail = detail;
  }

  private retry(): void {
    this.hasError = false;
    this.isLoading = true;
    this.controller.loadUrl(APP_URL);
  }

  private openExternal(url: string): void {
    const context = getContext(this) as common.UIAbilityContext;
    context.openLink(url).catch(() => {
      this.showError('无法打开外部链接', '系统浏览器没有响应，请稍后重试。');
    });
  }

  private handleMainFrameNavigation(url: string): boolean {
    if (this.isTrustedMainFrame(url)) {
      return false;
    }

    if (url.startsWith('https://')) {
      this.openExternal(url);
      return true;
    }

    this.showError('链接已拦截', '仅允许安全的 BabyForge 页面和 HTTPS 外部链接。');
    return true;
  }

  private handleNewWindow(url: string): void {
    if (this.isTrustedMainFrame(url)) {
      // Do not create a second embedded WebView; keep trusted content in the shell.
      this.controller.loadUrl(url);
      return;
    }

    if (url.startsWith('https://')) {
      this.openExternal(url);
      return;
    }

    this.showError('链接已拦截', '仅允许安全的 BabyForge 页面和 HTTPS 外部链接。');
  }

  private supportsPhotoPicker(event: OnShowFileSelectorEvent): boolean {
    const acceptTypes = event.fileSelector.getAcceptType();
    if (acceptTypes.length === 0) {
      return false;
    }
    return acceptTypes.every((type: string) => {
      const normalized = type.toLowerCase();
      return normalized.startsWith('image/') || normalized === '.heic' || normalized === '.heif';
    });
  }

  private openPhotoPicker(event: OnShowFileSelectorEvent): void {
    const options = new photoAccessHelper.PhotoSelectOptions();
    options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
    options.maxSelectNumber = event.fileSelector.getMode() === FileSelectorMode.FileOpenMultipleMode ? 50 : 1;

    new photoAccessHelper.PhotoViewPicker().select(options)
      .then((result: photoAccessHelper.PhotoSelectResult) => {
        event.result.handleFileList(result.photoUris);
      })
      .catch(() => {
        event.result.handleFileList([]);
      });
  }

  build(): void {
    Stack() {
      Web({ src: APP_URL, controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .databaseAccess(true)
        .onlineImageAccess(true)
        .fileAccess(false)
        .multiWindowAccess(true)
        .allowWindowOpenMethod(true)
        .padding({ top: this.topAvoidHeight, bottom: this.bottomAvoidHeight })
        .onPageBegin(() => {
          this.isLoading = true;
          this.hasError = false;
        })
        .onPageEnd(() => {
          if (!this.hasError) {
            this.isLoading = false;
          }
        })
        .onErrorReceive((event) => {
          if (event.request.isMainFrame()) {
            this.showError('页面加载失败', event.error.getErrorInfo());
          }
        })
        .onHttpErrorReceive((event) => {
          if (event.request.isMainFrame() && event.response.getResponseCode() >= 400) {
            this.showError('服务暂时不可用', `服务器返回 ${event.response.getResponseCode()}，请稍后重试。`);
          }
        })
        .onSslErrorEventReceive((event) => {
          event.handler.handleCancel();
          this.showError('连接不安全', 'BabyForge 的安全连接验证失败，已停止加载。');
        })
        .onRenderExited(() => {
          this.showError('页面进程已退出', '页面需要重新加载才能继续使用。');
        })
        .onShowFileSelector((event) => {
          if (!this.supportsPhotoPicker(event)) {
            return false;
          }
          this.openPhotoPicker(event);
          return true;
        })
        .onWindowNew((event) => {
          // No second embedded WebView is created. Explicitly release the
          // pending window request so ArkWeb does not block its render process.
          event.handler.setWebController(null);
          this.handleNewWindow(event.targetUrl);
        })
        .onLoadIntercept((event) => {
          const request = event.data;
          if (!request.isMainFrame()) {
            return false;
          }

          return this.handleMainFrameNavigation(request.getRequestUrl());
        })
        .backgroundColor(Color.Transparent);

      if (this.isLoading && !this.hasError) {
        Column() {
          Text('BabyForge')
            .fontSize(28)
            .fontWeight(FontWeight.Medium)
            .fontColor('#4E3B35');
          Text('正在打开你的照护空间…')
            .margin({ top: 12 })
            .fontSize(15)
            .fontColor('#806E68');
          LoadingProgress()
            .width(28)
            .height(28)
            .margin({ top: 24 })
            .color('#E68C75');
        }
        .width('100%')
        .height('100%')
        .padding({ top: this.topAvoidHeight, bottom: this.bottomAvoidHeight })
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#FFF9F0');
      }

      if (this.hasError) {
        Column() {
          Text('BabyForge')
            .fontSize(28)
            .fontWeight(FontWeight.Medium)
            .fontColor('#4E3B35');
          Text(this.errorTitle)
            .fontSize(20)
            .fontWeight(FontWeight.Medium)
            .fontColor('#4E3B35')
            .margin({ top: 28 });
          Text(this.errorDetail)
            .fontSize(15)
            .fontColor('#806E68')
            .textAlign(TextAlign.Center)
            .margin({ top: 10, left: 32, right: 32 });
          Button('重试')
            .fontSize(16)
            .fontColor(Color.White)
            .backgroundColor('#E68C75')
            .borderRadius(22)
            .padding({ left: 30, right: 30, top: 10, bottom: 10 })
            .margin({ top: 28 })
            .onClick(() => this.retry());
        }
        .width('100%')
        .height('100%')
        .padding({ top: this.topAvoidHeight, bottom: this.bottomAvoidHeight })
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#FFF9F0');
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFF9F0');
  }
}
