import { webview } from '@kit.ArkWeb';

let activeController: webview.WebviewController | null = null;

export function registerWebController(controller: webview.WebviewController): void {
  activeController = controller;
}

export function releaseWebController(controller: webview.WebviewController): void {
  if (activeController === controller) {
    activeController = null;
  }
}

export function handleWebBack(): boolean {
  if (activeController === null) {
    return false;
  }

  try {
    if (activeController.accessBackward()) {
      activeController.backward();
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
}
