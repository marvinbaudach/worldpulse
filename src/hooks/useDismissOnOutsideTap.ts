// Tooltip behavior for floating chrome (source note, action menu): any tap
// outside the elements marked with the given data attribute dismisses it.
import { useEffect } from 'react';

export function useDismissOnOutsideTap(open: boolean, dataAttr: string, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onTap = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.(`[${dataAttr}]`)) close();
    };
    window.addEventListener('pointerdown', onTap);
    return () => window.removeEventListener('pointerdown', onTap);
  }, [open, dataAttr, close]);
}
