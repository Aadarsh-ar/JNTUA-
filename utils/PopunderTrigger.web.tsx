import { useEffect } from "react";
import { ADSTERRA_CONFIG } from "./adConfig";

export interface PopunderTriggerProps {
  active: boolean;
  onFired?: () => void;
}

export function PopunderTrigger({ active, onFired }: PopunderTriggerProps) {
  useEffect(() => {
    if (!ADSTERRA_CONFIG.enabled || !active || !ADSTERRA_CONFIG.popunderScriptUrl) {
      return;
    }
    try {
      const script = document.createElement("script");
      script.src = ADSTERRA_CONFIG.popunderScriptUrl;
      script.async = true;
      script.onload = () => {
        try {
          const evt = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          document.body.dispatchEvent(evt);
        } catch {}
        onFired?.();
      };
      document.head.appendChild(script);
    } catch {}
  }, [active, onFired]);

  return null;
}
