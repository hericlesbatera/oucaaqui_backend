import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

/**
 * Indicador visual se música atual está sendo tocada offline
 */
const OfflineIndicator = () => {
    const { currentSong } = usePlayer();

    // Se a música não é offline ou não há música tocando, não mostra
    if (!currentSong?.isOffline) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium whitespace-nowrap">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
        </div>
    );
};

export default OfflineIndicator;
