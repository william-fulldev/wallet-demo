import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'wallet-demo-app',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
