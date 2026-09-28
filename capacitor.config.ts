import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karelisio.mijote',
  appName: 'Mijote',
  webDir: 'dist',
  android: {
    backgroundColor: '#FFF8F4',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: false,
      backgroundColor: '#FFF8F4',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_mijote',
      iconColor: '#9A4A1C',
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
