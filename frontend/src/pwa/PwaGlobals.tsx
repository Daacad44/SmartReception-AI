import { InstallBanner } from './InstallBanner';
import { UpdatePrompt } from './UpdatePrompt';

/**
 * Global PWA overlays: the auto install banner, the update-accept dialog,
 * and the offline indicator. Mount once, inside <PwaInstallProvider>.
 */
export function PwaGlobals() {
  return (
    <>
      <InstallBanner />
      <UpdatePrompt />
    </>
  );
}
