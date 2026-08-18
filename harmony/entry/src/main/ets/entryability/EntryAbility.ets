import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  private mainWindow: window.Window | null = null;
  private systemTopAvoidHeight: number = 0;
  private systemBottomAvoidHeight: number = 0;
  private keyboardBottomAvoidHeight: number = 0;

  private readonly onAvoidAreaChange = (options: window.AvoidAreaOptions): void => {
    this.updateAvoidArea(options.type, options.area);
  };

  private publishNativeAuthCallback(want: Want): void {
    const uri = typeof want.uri === 'string' ? want.uri : '';
    if (!uri.startsWith('babyforge://auth/callback')) return;
    // Keep the callback in app storage so both cold starts and singleton
    // relaunches can hand it to the native page without exposing it in logs.
    AppStorage.setOrCreate('nativeAuthCallback', uri);
    hilog.info(0x0000, 'BabyForge', 'Native auth callback received');
  }

  private updateAvoidArea(type: window.AvoidAreaType, area: window.AvoidArea): void {
    const top = area.visible ? px2vp(area.topRect.height) : 0;
    const bottom = area.visible ? px2vp(area.bottomRect.height) : 0;
    if (type === window.AvoidAreaType.TYPE_SYSTEM) {
      this.systemTopAvoidHeight = top;
      this.systemBottomAvoidHeight = bottom;
    } else if (type === window.AvoidAreaType.TYPE_KEYBOARD) {
      this.keyboardBottomAvoidHeight = bottom;
    } else {
      return;
    }

    AppStorage.setOrCreate('topAvoidHeight', this.systemTopAvoidHeight);
    AppStorage.setOrCreate(
      'bottomAvoidHeight',
      Math.max(this.systemBottomAvoidHeight, this.keyboardBottomAvoidHeight)
    );
  }

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.publishNativeAuthCallback(want);
    hilog.info(0x0000, 'BabyForge', 'Ability created');
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.publishNativeAuthCallback(want);
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    const mainWindow = windowStage.getMainWindowSync();
    this.mainWindow = mainWindow;
    mainWindow.setWindowLayoutFullScreen(true);
    this.updateAvoidArea(window.AvoidAreaType.TYPE_SYSTEM, mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM));
    this.updateAvoidArea(window.AvoidAreaType.TYPE_KEYBOARD, mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_KEYBOARD));
    mainWindow.on('avoidAreaChange', this.onAvoidAreaChange);

    windowStage.loadContent('pages/Index', (error) => {
      if (error.code) {
        hilog.error(0x0000, 'BabyForge', 'Failed to load page: %{public}s', JSON.stringify(error));
      }
    });
  }

  onWindowStageDestroy(): void {
    if (this.mainWindow !== null) {
      this.mainWindow.off('avoidAreaChange', this.onAvoidAreaChange);
      this.mainWindow = null;
    }
    hilog.info(0x0000, 'BabyForge', 'Window stage destroyed');
  }

  onForeground(): void {
    hilog.info(0x0000, 'BabyForge', 'Ability foreground');
  }

  onBackground(): void {
    hilog.info(0x0000, 'BabyForge', 'Ability background');
  }
}
