import { describe, expect, it } from 'vitest';
import { normalizeSourceUrl, safeHttpUrl } from '@/lib/url';
import { emptyState, ingredientFromText, recipeFromState } from '@/features/recipes/editorModel';

describe('safeHttpUrl', () => {
  it('keeps absolute http(s) URLs', () => {
    expect(safeHttpUrl('https://www.marmiton.org/recettes/x.aspx')).toBe(
      'https://www.marmiton.org/recettes/x.aspx',
    );
    expect(safeHttpUrl(' http://blog.example.com/a?b=1 ')).toBe('http://blog.example.com/a?b=1');
    expect(safeHttpUrl('HTTPS://EXAMPLE.COM')).toBe('HTTPS://EXAMPLE.COM');
  });

  it('rejects other schemes and junk', () => {
    for (const bad of [
      'javascript:alert(1)',
      ' JavaScript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'file:///data/data/com.karelisio.mijote',
      'intent://scan#Intent;scheme=zxing;end',
      'https://',
      'marmiton.org',
      '',
      null,
      undefined,
    ]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });
});

describe('normalizeSourceUrl', () => {
  it('adds https:// to a bare domain and keeps full URLs', () => {
    expect(normalizeSourceUrl('marmiton.org/recettes/tarte')).toBe('https://marmiton.org/recettes/tarte');
    expect(normalizeSourceUrl('www.750g.com')).toBe('https://www.750g.com');
    expect(normalizeSourceUrl('http://example.fr/x')).toBe('http://example.fr/x');
  });

  it('drops other schemes and free text', () => {
    expect(normalizeSourceUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeSourceUrl('JAVASCRIPT://%0aalert(1)')).toBeNull();
    expect(normalizeSourceUrl('Livre de Mamie')).toBeNull();
    expect(normalizeSourceUrl('   ')).toBeNull();
  });

  it('keeps an ingredient line the parser could not name when the editor saves', () => {
    const state = emptyState();
    state.title = 'Tarte';
    state.sections[0]!.items = [ingredientFromText('250 g'), ingredientFromText('10 noix')];
    const saved = recipeFromState(state, null).sections[0]!.items;
    expect(saved.map((i) => i.name)).toEqual(['250 g', 'noix']);
  });

  it('is applied when the editor saves', () => {
    const state = { ...emptyState(), title: 'Tarte', sourceUrl: 'javascript:alert(1)' };
    expect(recipeFromState(state, null).sourceUrl).toBeNull();
    const ok = { ...state, sourceUrl: 'marmiton.org/tarte' };
    expect(recipeFromState(ok, null).sourceUrl).toBe('https://marmiton.org/tarte');
  });
});
