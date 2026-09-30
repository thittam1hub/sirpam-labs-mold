// Sirpam 3D Labs Mold — global keyboard shortcuts (O/G/A/H/W/E/X/Y/Z/1-5/?).
import { useEffect } from 'react';
import type { AppState } from './state';
import type { Axis } from '../types';

export interface ShortcutDeps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  step: number;
  setStep: (n: number) => void;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onLoadFile: () => void;
  onGenerate: () => void;
  onAutoDetect: () => void;
}

/**
 * Installs the single global keydown listener for the Studio. Skips
 * interception entirely while a form control is focused (range inputs use
 * arrow keys, text inputs use every key) and while browser/OS chords
 * (Cmd/Ctrl/Alt) are held, so it never fights the platform or the panel's
 * own inputs.
 */
export function useShortcuts(deps: ShortcutDeps): void {
  const { state, setState, setStep, shortcutHelpOpen, setShortcutHelpOpen, onLoadFile, onGenerate, onAutoDetect } = deps;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ? (or Shift+/) toggles the cheat sheet. Escape always closes it.
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShortcutHelpOpen(v => !v);
        return;
      }
      if (e.key === 'Escape' && shortcutHelpOpen) {
        e.preventDefault();
        setShortcutHelpOpen(false);
        return;
      }
      // Suppress other shortcuts while the overlay reads like a modal dialog.
      if (shortcutHelpOpen) return;

      switch (e.key.toLowerCase()) {
        case 'o':
          e.preventDefault();
          onLoadFile();
          break;
        case 'g':
          if (state.originalGeometry && !state.generating) {
            e.preventDefault();
            onGenerate();
          }
          break;
        case 'a':
          if (state.originalGeometry && !state.autoDetecting) {
            e.preventDefault();
            onAutoDetect();
          }
          break;
        case 'h':
          if (state.originalGeometry) {
            e.preventDefault();
            setState(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }));
          }
          break;
        case 'w':
          if (state.originalGeometry) {
            e.preventDefault();
            setState(prev => ({ ...prev, wireframe: !prev.wireframe }));
          }
          break;
        case 'e':
          if (state.moldGenerated) {
            e.preventDefault();
            setState(prev => ({ ...prev, explodedView: !prev.explodedView }));
          }
          break;
        case 'x':
        case 'y':
        case 'z':
          if (state.originalGeometry) {
            e.preventDefault();
            setState(prev => ({ ...prev, axis: e.key.toLowerCase() as Axis }));
          }
          break;
        case '1': case '2': case '3': case '4': case '5':
          if (e.key === '1' || state.originalGeometry) {
            e.preventDefault();
            setStep(Number(e.key) - 1);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    shortcutHelpOpen, setShortcutHelpOpen, setState, setStep,
    state.originalGeometry, state.generating, state.autoDetecting, state.moldGenerated,
    onLoadFile, onGenerate, onAutoDetect,
  ]);
}
