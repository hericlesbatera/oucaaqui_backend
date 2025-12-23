import React, { useState, useEffect } from 'react';
import { ChevronDown, Volume2 } from 'lucide-react';
import { Button } from './ui/button';
import { usePlayer } from '../context/PlayerContext';

const cleanTitle = (title) => {
  return title?.replace(/\.mp3$/i, '') || '';
};

const MobilePlayerSheet = ({
  album,
  currentSong,
  albumSongs,
  onSongSelect,
  formatDuration,
  onClose
}) => {
  const { isPlaying, togglePlay, handlePrevious, handleNext, currentTime, duration, seekTo, isShuffle, repeatMode, toggleShuffle, toggleRepeat, volume, setVolume } = usePlayer();
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const checkIfFavorite = async () => {
    if (!currentSong) return;
    try {
      // Implementar verificação de favorito (será feito com seu banco de dados)
      // Por enquanto, usamos localStorage como fallback
      const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      setIsFavorite(favorites.includes(currentSong.id));
    } catch (error) {
      console.error('Erro ao verificar favorito:', error);
    }
  };

  useEffect(() => {
    // Verificar se a música está favoritada (você pode integrar com seu backend)
    checkIfFavorite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  const handleToggleFavorite = async () => {
    if (!currentSong) return;
    try {
      const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      if (isFavorite) {
        const newFavorites = favorites.filter(id => id !== currentSong.id);
        localStorage.setItem('favorites', JSON.stringify(newFavorites));
      } else {
        favorites.push(currentSong.id);
        localStorage.setItem('favorites', JSON.stringify(favorites));
      }
      setIsFavorite(!isFavorite);
      // Aqui você pode adicionar uma chamada para salvar no backend
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
    }
  };

  if (!currentSong) return null;

  const handleSeek = (e) => {
    const value = Number(e.target.value);
    seekTo(value);
  };

  return (
    <div className="md:hidden fixed inset-0 bg-black/90 text-white flex flex-col z-50 transition-all duration-300 ease-in-out">
      {/* Header with Controls */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-white hover:bg-white/10 rounded-full p-2 transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white border border-white/30 hover:bg-white/10 px-3 py-1 rounded-full text-sm"
          onClick={() => setShowPlaylist(!showPlaylist)}
        >
          Ver fila
        </Button>
      </div>

      {/* Album Art Carousel Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-0 py-8 w-full">
        <div className="w-full h-80 mb-6 relative px-4">
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-full overflow-hidden rounded-md shadow-xl">
              <img
                src={currentSong.coverImage}
                alt={currentSong.title}
                className="w-full h-full object-cover rounded-md"
                draggable="false"
                style={{ borderRadius: '30px' }}
              />
              <div className="absolute inset-0 bg-black/10 rounded-md"></div>
            </div>
          </div>
        </div>

      {/* Song Info */}
      <div className="text-center mb-8 w-full">
          <h2 className="text-xl font-bold text-white truncate">
            {cleanTitle(currentSong.title)}
          </h2>
          <p className="text-gray-300 truncate">{album.artistName}</p>
        </div>

        {/* Progress Bar and Controls */}
         <div className="w-full px-4">
           {/* Heart Icon and Volume Control Row - Above Progress Bar */}
           <div className="flex justify-between items-center mb-3">
             {/* Heart Icon */}
             <button
               onClick={handleToggleFavorite}
               className="flex-shrink-0 focus:outline-none hover:opacity-80 transition-opacity"
               title="Favoritar"
             >
               {isFavorite ? (
                 <svg
                   className="w-5 h-5 text-red-600 fill-current"
                   viewBox="0 0 24 24"
                   xmlns="http://www.w3.org/2000/svg"
                 >
                   <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                 </svg>
               ) : (
                 <svg
                   className="w-5 h-5 text-white"
                   stroke="currentColor"
                   fill="none"
                   strokeWidth="2"
                   viewBox="0 0 24 24"
                   xmlns="http://www.w3.org/2000/svg"
                 >
                   <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                 </svg>
               )}
             </button>

             {/* Volume Control */}
             <div className="relative flex-shrink-0">
               <button
                 onClick={() => setShowVolumeControl(!showVolumeControl)}
                 className="focus:outline-none hover:opacity-80 transition-opacity text-white"
                 title="Volume"
               >
                 <Volume2 className="w-5 h-5" />
               </button>
               
               {showVolumeControl && (
                 <div className="absolute bottom-full right-0 mb-2 bg-red-600 rounded-lg p-3 flex flex-col items-center gap-2 w-10 z-50">
                   <style>{`
                     .volume-slider {
                       background: linear-gradient(to top, black ${volume * 100}%, #9ca3af 0%) !important;
                       background-size: 100% 100%;
                       background-repeat: no-repeat;
                     }
                     .volume-slider::-webkit-slider-thumb {
                       appearance: none;
                       -webkit-appearance: none;
                       background: white;
                       cursor: pointer;
                       width: 14px;
                       height: 14px;
                       border-radius: 50%;
                       border: none;
                       box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                     }
                     .volume-slider::-webkit-slider-runnable-track {
                       background: transparent;
                       height: 100%;
                       border-radius: 4px;
                     }
                     .volume-slider::-moz-range-thumb {
                       background: white;
                       cursor: pointer;
                       width: 14px;
                       height: 14px;
                       border-radius: 50%;
                       border: none;
                       box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                     }
                     .volume-slider::-moz-range-track {
                       background: transparent;
                       border: none;
                     }
                     .volume-slider::-moz-range-progress {
                       background: black;
                     }
                   `}</style>
                   <input
                     type="range"
                     min="0"
                     max="1"
                     step="0.01"
                     value={volume}
                     onChange={(e) => setVolume(parseFloat(e.target.value))}
                     className="volume-slider h-24 w-1 appearance-none cursor-pointer"
                     style={{
                       writingMode: 'bt-lr',
                       WebkitAppearance: 'slider-vertical'
                     }}
                   />
                   <span className="text-xs text-white mt-1">{Math.round(volume * 100)}%</span>
                 </div>
               )}
             </div>
           </div>

           {/* Progress Bar */}
           <div className="flex justify-between items-center text-xs text-gray-300 mb-2">
             <span>{formatDuration(Math.floor(currentTime))}</span>
             <span>{formatDuration(Math.floor(duration))}</span>
           </div>
           <div className="w-full h-1 bg-gray-700 rounded-full mb-6 relative cursor-pointer">
             <div
               className="absolute h-full bg-red-600 rounded-full"
               style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
             ></div>
             <div
               className="absolute h-3 w-3 bg-red-600 rounded-full -mt-1 shadow"
               style={{
                 left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)`,
                 top: '-1px',
                 cursor: 'pointer'
               }}
               onMouseDown={(e) => {
                 const rect = e.currentTarget.parentElement.getBoundingClientRect();
                 const seek = ((e.clientX - rect.left) / rect.width) * (duration || 1);
                 seekTo(seek);
               }}
             ></div>
             <input
               type="range"
               min="0"
               max={duration || 100}
               value={currentTime}
               onChange={handleSeek}
               className="w-full h-1 bg-transparent rounded-full cursor-pointer absolute top-0 left-0 opacity-0"
             />
           </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-8">
            {/* Shuffle Icon */}
            <button
              onClick={toggleShuffle}
              className={`text-2xl focus:outline-none hover:opacity-80 transition-opacity ${isShuffle ? 'text-red-600' : 'text-white'}`}
              title="Aleatório"
            >
              <svg
                stroke="currentColor"
                fill="currentColor"
                strokeWidth="0"
                viewBox="0 0 512 512"
                height="1em"
                width="1em"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" d="M400 304l48 48-48 48m0-288l48 48-48 48M64 352h85.19a80 80 0 0066.56-35.62L256 256"></path>
                <path fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" d="M64 160h85.19a80 80 0 0166.56 35.62l80.5 120.76A80 80 0 00362.81 352H416m0-192h-53.19a80 80 0 00-66.56 35.62L288 208"></path>
              </svg>
            </button>

            <button
              className="text-white text-3xl focus:outline-none hover:opacity-80 transition-opacity"
              onClick={handlePrevious}
            >
              <svg
                stroke="currentColor"
                fill="currentColor"
                strokeWidth="0"
                viewBox="0 0 24 24"
                height="1em"
                width="1em"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fill="none" d="M0 0h24v24H0z"></path>
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"></path>
              </svg>
            </button>

            <button
              className="bg-red-600 hover:bg-red-700 rounded-full w-14 h-14 flex items-center justify-center text-white text-2xl focus:outline-none transition-colors shadow-lg"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <svg
                  stroke="currentColor"
                  fill="currentColor"
                  strokeWidth="0"
                  viewBox="0 0 24 24"
                  height="1em"
                  width="1em"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path fill="none" d="M0 0h24v24H0z"></path>
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
                </svg>
              ) : (
                <svg
                  stroke="currentColor"
                  fill="currentColor"
                  strokeWidth="0"
                  viewBox="0 0 448 512"
                  height="1em"
                  width="1em"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"></path>
                </svg>
              )}
            </button>

            <button
              className="text-white text-3xl focus:outline-none hover:opacity-80 transition-opacity"
              onClick={handleNext}
            >
              <svg
                stroke="currentColor"
                fill="currentColor"
                strokeWidth="0"
                viewBox="0 0 24 24"
                height="1em"
                width="1em"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fill="none" d="M0 0h24v24H0z"></path>
                <path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z"></path>
              </svg>
            </button>

            {/* Repeat Icon */}
            <div className="relative">
              <button
                onClick={toggleRepeat}
                className={`text-2xl focus:outline-none hover:opacity-80 transition-opacity ${repeatMode !== 'off' ? 'text-red-600' : 'text-white'}`}
                title="Repetir"
              >
                <svg
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  height="1em"
                  width="1em"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <polyline points="17 2 21 6 17 10"></polyline>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                  <polyline points="7 22 3 18 7 14"></polyline>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>
              </button>
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 text-[8px] font-bold text-red-600 bg-white rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">1</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Modal */}
      {showPlaylist && (
        <div className="fixed inset-0 bg-black/80 z-50 md:hidden flex flex-col">
          <div className="bg-gradient-to-b from-gray-900 to-black flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700/30 sticky top-0 bg-gray-900/95">
              <h3 className="text-white font-semibold text-sm">Fila</h3>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-gray-800 h-8 w-8"
                onClick={() => setShowPlaylist(false)}
              >
                <ChevronDown className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-1 p-3">
              {albumSongs.map((song, index) => (
                <button
                  key={song.id}
                  onClick={() => {
                    onSongSelect(song);
                    setShowPlaylist(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                    currentSong.id === song.id
                      ? 'bg-red-600/20 border-l-2 border-red-600'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <span className="text-gray-400 text-xs w-5 flex-shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-white truncate">
                      {cleanTitle(song.title)}
                    </p>
                    <p className="text-gray-500 text-xs">{album.artistName}</p>
                  </div>
                  <span className="text-gray-500 text-xs flex-shrink-0">
                    {formatDuration(song.duration)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePlayerSheet;
