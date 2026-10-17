import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "ro.cinemy.app",
  appName: "Cinemy",
  webDir: "capacitor-shell",
  ...(serverUrl
    ? { server: { url: serverUrl, cleartext: serverUrl.startsWith("http://") } }
    : {}),
  android: {
    backgroundColor: "#141414",
  },
};

export default config;
