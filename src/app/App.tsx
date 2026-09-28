import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { NavBar, type NavDest } from '@/ui/NavBar';
import { SnackbarHost } from '@/ui/Snackbar';
import { useT } from '@/i18n';
import { popBack } from '@/platform/backStack';
import { MijoteNative, isNative } from '@/platform/native';
import { useThemeController } from '@/theme/useThemeController';
import { useShoppingCount } from '@/features/shopping/useShoppingCount';
import { useTimerTicker } from '@/features/cooking/useTimerTicker';
import { ActiveTimersPill } from '@/features/cooking/ActiveTimersPill';
import { RecipesPage } from '@/features/recipes/RecipesPage';
import { RecipeDetailPage } from '@/features/recipes/RecipeDetailPage';
import { usePendingImport } from '@/features/import/pendingImport';
import { deepLinkToPath } from './deepLink';
import { MagoDialogHost } from '@/features/mago/MagoDialogHost';

const RecipeEditorPage = lazy(() => import('@/features/recipes/RecipeEditorPage'));
const CookingPage = lazy(() => import('@/features/cooking/CookingPage'));
const ImportPage = lazy(() => import('@/features/import/ImportPage'));
const ImportReviewPage = lazy(() => import('@/features/import/ImportReviewPage'));
const CookWithPage = lazy(() => import('@/features/recipes/CookWithPage'));
const PlannerPage = lazy(() => import('@/features/planner/PlannerPage'));
const ShoppingPage = lazy(() => import('@/features/shopping/ShoppingPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

const TABS = ['/recipes', '/planner', '/shopping', '/settings'];

function useNativeIntegration() {
  const navigate = useNavigate();
  const location = useLocation();
  const setShared = usePendingImport((s) => s.setShared);

  // Android back button: overlays first, then history, then tabs, then minimise.
  useEffect(() => {
    if (!isNative()) return;
    const h = CapApp.addListener('backButton', () => {
      if (popBack()) return;
      const path = window.location.pathname;
      if (TABS.includes(path)) {
        if (path !== '/recipes') navigate('/recipes', { replace: true });
        else void CapApp.minimizeApp();
      } else {
        navigate(-1);
      }
    });
    return () => void h.then((x) => x.remove());
  }, [navigate]);

  // App shortcuts and deep links.
  useEffect(() => {
    if (!isNative()) return;
    void CapApp.getLaunchUrl().then((r) => {
      const p = r?.url ? deepLinkToPath(r.url) : null;
      if (p) navigate(p);
    });
    const h = CapApp.addListener('appUrlOpen', ({ url }) => {
      const p = deepLinkToPath(url);
      if (p) navigate(p);
    });
    return () => void h.then((x) => x.remove());
  }, [navigate]);

  // "Share to Mijote" from the browser.
  useEffect(() => {
    if (!isNative()) return;
    const handle = (text?: string, subject?: string) => {
      if (!text) return;
      setShared({ text, subject: subject ?? '' });
      navigate('/import');
    };
    void MijoteNative.consumePendingShare()
      .then((r) => handle(r.text, r.subject))
      .catch(() => undefined);
    const h = MijoteNative.addListener('shareReceived', (d) => handle(d.text, d.subject));
    return () => void h.then((x) => x.remove());
  }, [navigate, setShared]);

  return location;
}

function PageFallback() {
  return <div className="screen" />;
}

export function App() {
  const t = useT();
  useThemeController();
  useTimerTicker();
  const location = useNativeIntegration();
  const shoppingCount = useShoppingCount();
  const showNav = TABS.includes(location.pathname);
  const isCooking = location.pathname.endsWith('/cook');

  const nav: NavDest[] = [
    { to: '/recipes', icon: 'menu_book', label: t('nav.recipes') },
    { to: '/planner', icon: 'calendar_month', label: t('nav.planner') },
    { to: '/shopping', icon: 'shopping_cart', label: t('nav.shopping'), badge: shoppingCount },
    { to: '/settings', icon: 'settings', label: t('nav.settings') },
  ];

  // Tabs cross-fade; pushed screens slide up slightly (Material "shared axis" feel).
  const isTab = showNav;
  return (
    <LayoutGroup>
      <AnimatePresence initial={false}>
        <motion.div
          key={location.pathname}
          style={{ position: 'absolute', inset: 0 }}
          initial={isTab ? { opacity: 0, scale: 0.99 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        >
          <Suspense fallback={<PageFallback />}>
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/recipes" replace />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/recipes/new" element={<RecipeEditorPage />} />
              <Route path="/recipes/:id" element={<RecipeDetailPage />} />
              <Route path="/recipes/:id/edit" element={<RecipeEditorPage />} />
              <Route path="/recipes/:id/cook" element={<CookingPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/import/review" element={<ImportReviewPage />} />
              <Route path="/cook-with" element={<CookWithPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/shopping" element={<ShoppingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/recipes" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      {showNav && <NavBar items={nav} />}
      {!isCooking && <ActiveTimersPill aboveNav={showNav} />}
      <SnackbarHost aboveNav={showNav} />
      <MagoDialogHost />
    </LayoutGroup>
  );
}
