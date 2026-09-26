import React from "react";

export interface PopunderTriggerProps {
  active: boolean;
  onFired?: () => void;
}

export declare function PopunderTrigger(props: PopunderTriggerProps): React.JSX.Element | null;
