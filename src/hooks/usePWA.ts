"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    if (isStandalone) {
      setIsInstalled(true);
      console.log("PWA: App is already running in standalone mode");
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    if (isIOSDevice) {
      console.log("PWA: iOS device detected");
    }

    const checkGlobalPrompt = () => {
      const globalPrompt = (window as any).deferredPWAInstallPrompt;
      if (globalPrompt) {
        console.log("PWA: Hook using globally captured prompt");
        setDeferredPrompt(globalPrompt);
        setIsInstallable(true);
      }
    };

    // Check immediately if it was already captured
    checkGlobalPrompt();

    const handler = (e: Event) => {
      console.log("PWA: beforeinstallprompt event fired (hook listener)");
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("pwa-prompt-captured", checkGlobalPrompt);

    const installedHandler = () => {
      console.log("PWA: appinstalled event fired");
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("pwa-prompt-captured", checkGlobalPrompt);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) {
      console.warn("PWA: No deferred prompt available");
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`PWA: User ${outcome} the install prompt`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
    (window as any).deferredPWAInstallPrompt = null;
  };

  return { isInstallable, isInstalled, isIOS, install };
}
