import React, { useState } from 'react';
import { Download, Smartphone, Check, Share } from 'lucide-react';
import usePWAInstall from '../../hooks/usePWAInstall';

// Rileva iOS (iPhone/iPad/iPod), incluso iPad su Safari a partire da iPadOS 13
// che si identifica come Mac.
const isIOS = () => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Card "App Web Progressiva" per la pagina di login.
//
// - Desktop/mobile su browser Chromium (Chrome, Edge, Android): quando il
//   browser ha emesso beforeinstallprompt mostra il pulsante "Installa
//   l'app" che innesca il prompt nativo.
// - iOS/Safari (beforeinstallprompt non disponibile mai): mostra le
//   istruzioni manuali con l'icona di condivisione + "Aggiungi alla
//   schermata Home" (Safari mostra la share sheet al tap).
// - App già installata (standalone): non viene mai resa (i render nel
//   Login sono già condizionali, ma si difende comunque).
const PWAInstallCard = ({ variant = 'mobile' }) => {
    const { canInstall, installed, install } = usePWAInstall();
    const [outcome, setOutcome] = useState(null);
    const ios = isIOS();

    if (installed) return null;

    const handleInstall = async () => {
        const result = await install();
        if (result) setOutcome(result);
        if (result === 'dismissed' || result === 'cancelled') {
            // Svuota dopo poco per non lasciare il badge di esito
            setTimeout(() => setOutcome(null), 3000);
        }
    };

    if (variant === 'desktop') {
        // Pannello laterale scuro del login desktop
        return (
            <div className="mt-12 p-4 bg-blue-500 bg-opacity-20 rounded-lg border border-blue-400 border-opacity-30">
                <div className="flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-3">
                        <Smartphone className="h-5 w-5 text-blue-200 flex-shrink-0" />
                        <div>
                            <p className="text-white text-sm font-medium">
                                {ios ? 'Aggiungi all\'iPad o all\'iPhone' : 'Installa l\'app sul dispositivo'}
                            </p>
                            <p className="text-blue-100 text-xs">
                                {ios
                                    ? 'Safari: tocca Condividi, poi "Aggiungi alla schermata Home"'
                                    : 'Accesso rapido come un\'app nativa, anche da home screen'}
                            </p>
                        </div>
                    </div>

                    {canInstall && (
                        <button
                            type="button"
                            onClick={handleInstall}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-white text-blue-700 text-xs font-semibold rounded-md hover:bg-blue-50 transition-colors flex-shrink-0"
                        >
                            {outcome === 'accepted' ? (
                                <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Installata</span>
                                </>
                            ) : (
                                <>
                                    <Download className="h-3.5 w-3.5" />
                                    <span>Installa</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Variante mobile (sotto il form di login)
    return (
        <div className="p-5 bg-gradient-to-r from-blue-500 to-blue-700 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-3">
                    <Smartphone className="h-5 w-5 text-white flex-shrink-0" />
                    <div>
                        <p className="text-white text-sm font-semibold">App Web Progressiva</p>
                        <p className="text-blue-100 text-xs">
                            {canInstall
                                ? 'Installa l\'app per un accesso più rapido'
                                : 'Installabile su smartphone e tablet'}
                        </p>
                    </div>
                </div>

                {canInstall && (
                    <button
                        type="button"
                        onClick={handleInstall}
                        className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0"
                    >
                        {outcome === 'accepted' ? (
                            <>
                                <Check className="h-4 w-4" />
                                <span>Installata</span>
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                <span>Installa</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Fallback iOS: Safari non espone il prompt nativo */}
            {ios && (
                <div className="mt-3 pt-3 border-t border-white border-opacity-20">
                    <p className="text-blue-100 text-xs leading-relaxed">
                        <Share className="inline h-3 w-3 mr-1 align-[-1px]" />
                        In Safari tocca <strong className="text-white">Condividi</strong> e poi{' '}
                        <strong className="text-white">"Aggiungi alla schermata Home"</strong> per
                        usare l'app come se fosse nativa.
                    </p>
                </div>
            )}
        </div>
    );
};

export default PWAInstallCard;