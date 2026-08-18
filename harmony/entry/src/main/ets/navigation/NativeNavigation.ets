export type NativeTab = 'today' | 'record' | 'ai' | 'growth' | 'explore';

export const NATIVE_TABS: Array<NativeTab> = ['today', 'record', 'ai', 'growth', 'explore'];

export interface NativeTabState {
  tab: NativeTab;
  stack: Array<string>;
  scrollPosition: number;
  temporaryInput: string;
}

function rootFor(tab: NativeTab): string {
  return `${tab}.root`;
}

function createTabState(tab: NativeTab): NativeTabState {
  return {
    tab,
    stack: [rootFor(tab)],
    scrollPosition: 0,
    temporaryInput: ''
  };
}

export class NativeNavigationStore {
  private states: Array<NativeTabState> = NATIVE_TABS.map((tab: NativeTab) => createTabState(tab));

  private indexOf(tab: NativeTab): number {
    return this.states.findIndex((state: NativeTabState) => state.tab === tab);
  }

  state(tab: NativeTab): NativeTabState {
    return this.states[this.indexOf(tab)];
  }

  push(tab: NativeTab, route: string): void {
    const current = this.state(tab);
    if (current.stack[current.stack.length - 1] !== route) current.stack.push(route);
  }

  back(tab: NativeTab): boolean {
    const current = this.state(tab);
    if (current.stack.length <= 1) return false;
    current.stack.pop();
    return true;
  }

  repeat(tab: NativeTab): void {
    const current = this.state(tab);
    if (current.stack.length > 1) current.stack = [rootFor(tab)];
    current.scrollPosition = 0;
  }

  setScrollPosition(tab: NativeTab, position: number): void {
    this.state(tab).scrollPosition = Math.max(0, position);
  }

  setTemporaryInput(tab: NativeTab, value: string): void {
    this.state(tab).temporaryInput = value;
  }

  clearTemporaryInput(tab: NativeTab): void {
    this.state(tab).temporaryInput = '';
  }
}
