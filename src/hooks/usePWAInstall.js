import { useCallback, useEffect, useState } from 'react';
import { installManager } from '../utils/serviceWorker';

// Hook React per l'installazione PWA.
//
// Restituisce:
//   canInstall  — il prompt nativo (beforeinstallprompt) è disponibile
//   installed   — l'app gira già in standalone (installata)
//   install()   — innesca il prompt nativo; restituisce
//                 'accepted' | 'dismissed' | 'cancelled' | null
//
// Su iOS/Safari beforeinstallprompt non viene mai emesso: canInstall
// resta false e il componente PWAInstallCard mostra le istruzioni
// manuali "Aggiungi alla schermata Home".
const usePWAInstall = () => {
    const [canInstall, setCanInstall] = useState(installManager.canInstall());
    const [installed, setInstalled] = useState(installManager.isInstalled());

    useEffect(() => {
        setCanInstall(installManager.canInstall());
        setInstalled(installManager.isInstalled());
        return installManager.subscribe(() => {
            setCanInstall(installManager.canInstall());
            setInstalled(installManager.isInstalled());
        });
    }, []);

    const install = useCallback(async () => {
        const outcome = await installManager.promptInstall();
        setCanInstall(installManager.canInstall());
        return outcome;
    }, []);

    return { canInstall, installed, install };
};

export default usePWAInstall;