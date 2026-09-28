import { useEffect, useLayoutEffect, useRef } from 'react';

type Handler = () => void;
const stack: { id: number; handler: React.RefObject<Handler> }[] = [];
let seq = 0;

/** Registers an overlay-level back handler while `active` (last registered wins). */
export function useBackHandler(active: boolean, handler: Handler): void {
  const ref = useRef<Handler>(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const id = ++seq;
    stack.push({ id, handler: ref });
    return () => {
      const i = stack.findIndex((e) => e.id === id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Calls the top-most overlay handler. Returns false if none is registered. */
export function popBack(): boolean {
  const top = stack.at(-1);
  if (!top) return false;
  top.handler.current?.();
  return true;
}
