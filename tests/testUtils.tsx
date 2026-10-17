import React, { act } from 'react';
import { render, fireEvent, screen, waitFor, renderHook, cleanup, RenderResult } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

export { render, fireEvent, screen, waitFor, renderHook, cleanup, act };

export type UiRoot = TestInstance & {
  findAll: (predicate: (node: TestInstance) => boolean) => TestInstance[];
  findAllByType: (type: string) => TestInstance[];
  findByType: (type: string) => TestInstance;
};

export type UiTree = Omit<RenderResult, 'root'> & {
  root: UiRoot;
};

/**
 * Concatenates all inline text children inside a node.
 */
function collectText(node: TestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(collectText).join('');
}

/**
 * Mounts a React element using `@testing-library/react-native`.
 */
export async function renderUi(element: React.ReactElement): Promise<UiTree> {
  const result = await render(element);
  const root: UiRoot = Object.assign(result.container, {
    findAll: (predicate: (node: TestInstance) => boolean) => result.container.queryAll(predicate),
    findAllByType: (type: string) => result.container.queryAll(n => n.type === type),
    findByType: (type: string) => {
      const matches = result.container.queryAll(n => n.type === type);
      if (matches.length === 0) throw new Error(`No node found with type ${type}`);
      return matches[0];
    },
  });
  Object.defineProperty(result, 'root', { configurable: true, enumerable: true, value: root });
  return result as unknown as UiTree;
}

/**
 * Extracts all rendered text strings from `<Text>` and `<Animated.Text>` nodes.
 */
export function getAllText(tree: UiTree): string[] {
  if (!tree.toJSON()) return [];
  return tree.container.queryAll(node => node.type === 'Text' || node.type === 'Animated.Text').map(collectText);
}

/**
 * Checks whether the rendered tree contains the given substring in any text node.
 */
export function hasText(tree: UiTree, substring: string): boolean {
  return getAllText(tree).some(text => text.includes(substring));
}

/**
 * Finds the nearest pressable ancestor (`onPress` prop) containing the given text.
 */
export function findPressableByText(tree: UiTree, text: string): TestInstance | null {
  const candidates = tree.container.queryAll(node => typeof node.props?.onPress === 'function');
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (collectText(candidates[i]).includes(text)) {
      return candidates[i];
    }
  }
  return null;
}

/**
 * Triggers `onPress` on the pressable element containing `text`.
 */
export async function pressByText(tree: UiTree, text: string): Promise<void> {
  const target = findPressableByText(tree, text);
  if (!target || typeof target.props.onPress !== 'function') {
    throw new Error(`No pressable found containing text "${text}". Available text: ${getAllText(tree).join(' | ')}`);
  }
  await act(async () => {
    await (target.props.onPress as () => unknown)();
  });
}
