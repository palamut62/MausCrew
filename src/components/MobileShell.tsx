import { type ReactNode } from "react";
import { useMobileLayout } from "@/lib/mobile";
import { MobileDashboard } from "./MobileDashboard";
import { MobileDecisionRail } from "./MobileDecisionRail";
import { MobileMonospaceZen } from "./MobileMonospaceZen";

/** Picks the mobile skin this phone is set to. The choice lives on the device. */
export function MobileShell({ children, onBrowseDirectory }: {
  children: ReactNode;
  onBrowseDirectory: () => void;
}) {
  const [layout] = useMobileLayout();
  if (layout === "zen") return <MobileMonospaceZen onBrowseDirectory={onBrowseDirectory}>{children}</MobileMonospaceZen>;
  if (layout === "simple") return <MobileDashboard onBrowseDirectory={onBrowseDirectory}>{children}</MobileDashboard>;
  return <MobileDecisionRail onBrowseDirectory={onBrowseDirectory}>{children}</MobileDecisionRail>;
}
