/** Global, delegated Material ripple for every element with the `ripple` class. */
export function installRipple(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      const target = (e.target as Element | null)?.closest<HTMLElement>('.ripple');
      if (!target || target.hasAttribute('disabled')) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const wave = document.createElement('span');
      wave.className = 'ripple-wave';
      wave.style.width = wave.style.height = `${size}px`;
      wave.style.left = `${e.clientX - rect.left - size / 2}px`;
      wave.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(wave);
      wave.addEventListener('animationend', () => wave.remove(), { once: true });
    },
    { passive: true },
  );
}
