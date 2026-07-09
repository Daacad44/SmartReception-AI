import { InstallBanner } from './InstallBanner';
import { UpdatePrompt } from './UpdatePrompt';

/**
 * Global PWA overlays: the auto install banner and the update / offline
 * indicators. Mount once, inside <PwaInstallProvider>.
 */
export function PwaGlobals() {
  return (
    <>
      <InstallBanner />
      <UpdatePrompt />
    </>
  );
}
