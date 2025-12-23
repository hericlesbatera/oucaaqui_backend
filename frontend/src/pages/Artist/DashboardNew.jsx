import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { BarChart3, ChevronDown, Loader2, Music } from 'lucide-react';
import { useTrackPageView } from '../../hooks/useTrackPageView';
import ArtistSidebar from '../../components/Artist/ArtistSidebar';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import LoadingSpinner from '../../components/LoadingSpinner';

const DashboardNew = () => {
  useTrackPageView('artist-dashboard-new');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('geral');
  const [period, setPeriod] = useState('7');
  const [dataType, setDataType] = useState('plays');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ plays: 0, downloads: 0 });
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showDataTypeDropdown, setShowDataTypeDropdown] = useState(false);
  const [expandedAlbums, setExpandedAlbums] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [expandedPlaylists, setExpandedPlaylists] = useState(false);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const formattedToday = today.toLocaleDateString('pt-BR');
  const formattedYesterday = yesterday.toLocaleDateString('pt-BR');

  useEffect(() => {
    loadData();
  }, [user?.id, activeTab, period, selectedAlbum, selectedPlaylist]);

  // Auto-select first item when switching tabs
  // NOTE: This is now handled inside loadData() to ensure proper sequencing
  useEffect(() => {
    console.log('\n>>> Auto-select useEffect (DEPRECATED - now in loadData) <<<');
    console.log('  activeTab:', activeTab);
    console.log('  albums.length:', albums.length);
    console.log('  playlists.length:', playlists.length);
    console.log('  selectedAlbum:', selectedAlbum);
    console.log('  selectedPlaylist:', selectedPlaylist);
    console.log('>>> End Auto-select <<<\n');
    
    // NO AUTO-SELECT HERE - it's now done in loadData()
  }, [activeTab, albums, playlists, selectedAlbum, selectedPlaylist]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    
    console.log('\n\n *** LOADATA START ***');
    console.log('Current state:');
    console.log('  user.id:', user?.id);
    console.log('  activeTab:', activeTab);
    console.log('  selectedAlbum:', selectedAlbum);
    console.log('  selectedPlaylist:', selectedPlaylist);
    console.log('  albums:', albums.length);
    console.log('  playlists:', playlists.length);

    try {
      // Buscar álbuns do artista ordenados por data de lançamento
      let { data: albumsData, error: albumsError } = await supabase
        .from('albums')
        .select('*')
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false });

      setAlbums(albumsData || []);

      // Buscar playlists do artista
      let { data: playlistsData } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setPlaylists(playlistsData || []);
      
      console.log('\n*** AUTO-SELECT LOGIC START ***');
      console.log('activeTab:', activeTab);
      console.log('selectedAlbum:', selectedAlbum);
      console.log('selectedPlaylist:', selectedPlaylist);
      console.log('albumsData length:', albumsData?.length);
      console.log('playlistsData length:', playlistsData?.length);
      
      // AUTO-SELECT LOGIC: Execute here before fetching stats to ensure selectedItem is set
      let finalSelectedAlbum = selectedAlbum;
      let finalSelectedPlaylist = selectedPlaylist;
      
      if (activeTab === 'cds' && albumsData && albumsData.length > 0 && !selectedAlbum) {
        console.log('CONDITION MET: activeTab=cds, has albums, no selection');
        console.log('AUTO-SELECT: Setting first album:', albumsData[0].id);
        finalSelectedAlbum = albumsData[0].id;
        setSelectedAlbum(albumsData[0].id);
      }
      
      if (activeTab === 'playlists' && playlistsData && playlistsData.length > 0 && !selectedPlaylist) {
        console.log('CONDITION MET: activeTab=playlists, has playlists, no selection');
        console.log('AUTO-SELECT: Setting first playlist:', playlistsData[0].id);
        finalSelectedPlaylist = playlistsData[0].id;
        setSelectedPlaylist(playlistsData[0].id);
      } else if (activeTab === 'playlists') {
        console.log('CONDITION NOT MET for auto-select:');
        console.log('  activeTab===playlists?', activeTab === 'playlists');
        console.log('  playlistsData?', !!playlistsData);
        console.log('  playlistsData.length > 0?', playlistsData?.length > 0);
        console.log('  !selectedPlaylist?', !selectedPlaylist);
      }
      
      console.log('finalSelectedAlbum:', finalSelectedAlbum);
      console.log('finalSelectedPlaylist:', finalSelectedPlaylist);
      console.log('*** AUTO-SELECT LOGIC END ***\n');

      // Buscar estatísticas reais da API
      // Detectar se está em desenvolvimento ou produção
      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const statsUrl = new URL(`/api/statistics/artist/${user.id}/stats`, apiBaseUrl);
      statsUrl.searchParams.append('period', parseInt(period));
      
      // Adicionar album_id se selecionado e estamos na aba CDS
      console.log('CHECK 1: activeTab === cds?', activeTab === 'cds', '| finalSelectedAlbum?', !!finalSelectedAlbum);
      if (activeTab === 'cds' && finalSelectedAlbum) {
        console.log('✓✓✓ ENTERING CDS BRANCH with:', finalSelectedAlbum);
        statsUrl.searchParams.append('album_id', finalSelectedAlbum);
      }
      
      // Adicionar playlist_id se selecionado e estamos na aba PLAYLISTS
      console.log('CHECK 2: activeTab === playlists?', activeTab === 'playlists', '| finalSelectedPlaylist?', !!finalSelectedPlaylist);
      if (activeTab === 'playlists' && finalSelectedPlaylist) {
        console.log('✓✓✓ ENTERING PLAYLISTS BRANCH with:', finalSelectedPlaylist);
        console.log('✓ Adding playlist_id to URL:', finalSelectedPlaylist);
        statsUrl.searchParams.append('playlist_id', finalSelectedPlaylist);
        // Add cache busting to prevent stale data
        statsUrl.searchParams.append('t', Date.now());
      } else if (activeTab === 'playlists' && !finalSelectedPlaylist) {
        console.warn('⚠️  PLAYLISTS tab but finalSelectedPlaylist is null!');
      }

      console.log('\n=== LoadData triggered ===');
      console.log('  activeTab:', activeTab);
      console.log('  selectedAlbum:', selectedAlbum);
      console.log('  selectedPlaylist:', selectedPlaylist);
      console.log('  playlists loaded:', playlists.length);
      console.log('Final URL:', statsUrl.toString());
      console.log('======================\n');
      
      // DEBUGGING: Log exactly what URL we're fetching
      const urlString = statsUrl.toString();
      console.log('DEBUG: About to fetch URL:', urlString);
      console.log('DEBUG: URL has playlist_id?', urlString.includes('playlist_id'));
      console.log('DEBUG: Full URL breakdown:', {
        href: statsUrl.href,
        search: statsUrl.search,
        pathname: statsUrl.pathname
      });
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        const statsResponse = await fetch(urlString, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        
        console.log('Stats response status:', statsResponse.status);
         
         if (statsResponse.ok) {
           const statsData = await statsResponse.json();
           console.log('Stats data received:', statsData);
           console.log('DEBUG: Backend returned plays:', statsData.total_plays);
           console.log('DEBUG: Expected plays for this playlist: 2');
           console.log('DEBUG: Plays match playlist data?', statsData.total_plays === 2 ? 'YES' : 'NO (PROBLEM!)');
           setStats({ plays: statsData.total_plays, downloads: statsData.total_downloads });
           setChartData(statsData.chart_data);
        } else {
          // Fallback: se a API falhar, mostrar zeros
          const errorText = await statsResponse.text();
          console.warn('Erro ao buscar estatísticas da API:', statsResponse.status, errorText);
          setStats({ plays: 0, downloads: 0 });
          
          // Inicializar gráfico vazio
          const days = parseInt(period);
          const emptyData = [];
          for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            const dayStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            emptyData.push({ plays: 0, downloads: 0, date: dayStr });
          }
          setChartData(emptyData);
        }
      } catch (fetchError) {
        console.error('Erro no fetch:', fetchError);
        setStats({ plays: 0, downloads: 0 });
        setChartData([]);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setStats({ plays: 0, downloads: 0 });
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'geral', label: 'GERAL' },
    { id: 'cds', label: 'CDS/SINGLES' },
    { id: 'playlists', label: 'PLAYLISTS' }
  ];

  const periods = [
    { value: '7', label: 'Últimos 7 dias' },
    { value: '14', label: 'Últimos 14 dias' },
    { value: '30', label: 'Últimos 30 dias' }
  ];

  const maxValue = Math.max(...chartData.map(d => dataType === 'plays' ? d.plays : d.downloads), 1);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size="large" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-red-600" />
            <h1 className="text-3xl font-bold text-gray-900">Estatísticas</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
            {tabs.map(tab => (
              <Button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedAlbum(null);
                  setSelectedPlaylist(null);
                  setExpandedAlbums(false);
                  setExpandedPlaylists(false);
                }}
                className={`rounded-full px-6 ${
                  activeTab === tab.id
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-white border border-red-600 text-red-600 hover:bg-red-50'
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Album List (CDS/SINGLES tab) */}
          {activeTab === 'cds' && (
            <Card className="mb-6 border-red-200 overflow-hidden">
              <CardContent className="p-0">
                {loading && albums.length === 0 ? (
                  <div className="p-4 flex items-center gap-2 text-red-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando...
                  </div>
                ) : albums.length === 0 ? (
                  <div className="p-4 text-gray-500">Nenhum álbum encontrado</div>
                ) : (
                  <>
                    {/* Reorganizar álbuns: se há selecionado, mostra primeiro; senão, mostra o mais recente */}
                    {(() => {
                      let displayedAlbums = [...albums];
                      if (selectedAlbum) {
                        const selected = displayedAlbums.find(a => a.id === selectedAlbum);
                        if (selected) {
                          displayedAlbums = [selected, ...displayedAlbums.filter(a => a.id !== selectedAlbum)];
                        }
                      }
                      return displayedAlbums;
                    })().length > 0 && (
                      <>
                        {/* Mostrar primeiro álbum sempre visível */}
                        {(() => {
                          const displayedAlbums = selectedAlbum 
                            ? [albums.find(a => a.id === selectedAlbum), ...albums.filter(a => a.id !== selectedAlbum)]
                            : albums;
                          const firstAlbum = displayedAlbums[0];
                          
                          return (
                            <div
                              key={firstAlbum.id}
                              className={`flex items-center gap-4 p-4 border-b cursor-pointer hover:bg-gray-50 ${
                                selectedAlbum === firstAlbum.id ? 'bg-red-50' : ''
                              }`}
                              onClick={() => setSelectedAlbum(selectedAlbum === firstAlbum.id ? null : firstAlbum.id)}
                            >
                              <img
                                src={firstAlbum.cover_url || '/placeholder-album.jpg'}
                                alt={firstAlbum.title}
                                className="w-12 h-12 rounded object-cover"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-red-600">{firstAlbum.title}</p>
                                <p className="text-sm text-gray-500">
                                  Enviado: {new Date(firstAlbum.created_at).toLocaleDateString('pt-BR')} às {new Date(firstAlbum.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {albums.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedAlbums(!expandedAlbums);
                                  }}
                                  className="p-1"
                                >
                                  <ChevronDown className={`w-5 h-5 text-red-400 transition-transform ${expandedAlbums ? 'rotate-180' : ''}`} />
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {/* Expandir para mostrar outros álbuns */}
                        {albums.length > 1 && expandedAlbums && (
                          <>
                            {(() => {
                              const displayedAlbums = selectedAlbum 
                                ? [albums.find(a => a.id === selectedAlbum), ...albums.filter(a => a.id !== selectedAlbum)]
                                : albums;
                              return displayedAlbums.slice(1).map(album => (
                                <div
                                  key={album.id}
                                  className={`flex items-center gap-4 p-4 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                                    selectedAlbum === album.id ? 'bg-red-50' : ''
                                  }`}
                                  onClick={() => {
                                    setSelectedAlbum(album.id);
                                    setExpandedAlbums(false);
                                  }}
                                >
                                  <img
                                    src={album.cover_url || '/placeholder-album.jpg'}
                                    alt={album.title}
                                    className="w-12 h-12 rounded object-cover"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium text-red-600">{album.title}</p>
                                    <p className="text-sm text-gray-500">
                                      Enviado: {new Date(album.created_at).toLocaleDateString('pt-BR')} às {new Date(album.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              ));
                            })()}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Playlists tab */}
          {activeTab === 'playlists' && (
            <Card className="mb-6 border-red-200 overflow-hidden">
              <CardContent className="p-0">
                {loading && playlists.length === 0 ? (
                  <div className="p-4 flex items-center gap-2 text-red-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando...
                  </div>
                ) : playlists.length === 0 ? (
                  <div className="p-4 text-gray-500">Nenhuma playlist encontrada</div>
                ) : (
                  <>
                    {/* Mostrar primeira playlist sempre visível */}
                    {(() => {
                      const displayedPlaylists = selectedPlaylist 
                        ? [playlists.find(p => p.id === selectedPlaylist), ...playlists.filter(p => p.id !== selectedPlaylist)]
                        : playlists;
                      const firstPlaylist = displayedPlaylists[0];
                      
                      return (
                        <div
                          key={firstPlaylist.id}
                          className={`flex items-center gap-4 p-4 border-b cursor-pointer hover:bg-gray-50 ${
                            selectedPlaylist === firstPlaylist.id ? 'bg-red-50' : ''
                          }`}
                          onClick={() => setSelectedPlaylist(selectedPlaylist === firstPlaylist.id ? null : firstPlaylist.id)}
                        >
                          {firstPlaylist.cover_url ? (
                            <img
                              src={firstPlaylist.cover_url}
                              alt={firstPlaylist.title}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-red-100 flex items-center justify-center">
                              <Music className="w-6 h-6 text-red-600" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-red-600">{firstPlaylist.title}</p>
                            <p className="text-sm text-gray-500">
                              Criada: {new Date(firstPlaylist.created_at).toLocaleDateString('pt-BR')} às {new Date(firstPlaylist.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {playlists.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPlaylists(!expandedPlaylists);
                              }}
                              className="p-1"
                            >
                              <ChevronDown className={`w-5 h-5 text-red-400 transition-transform ${expandedPlaylists ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Expandir para mostrar outras playlists */}
                    {playlists.length > 1 && expandedPlaylists && (
                      <>
                        {(() => {
                          const displayedPlaylists = selectedPlaylist 
                            ? [playlists.find(p => p.id === selectedPlaylist), ...playlists.filter(p => p.id !== selectedPlaylist)]
                            : playlists;
                          return displayedPlaylists.slice(1).map(playlist => (
                            <div
                              key={playlist.id}
                              className={`flex items-center gap-4 p-4 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                                selectedPlaylist === playlist.id ? 'bg-red-50' : ''
                              }`}
                              onClick={() => {
                                setSelectedPlaylist(playlist.id);
                                setExpandedPlaylists(false);
                              }}
                            >
                              {playlist.cover_url ? (
                                <img
                                  src={playlist.cover_url}
                                  alt={playlist.title}
                                  className="w-12 h-12 rounded object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded bg-red-100 flex items-center justify-center">
                                  <Music className="w-6 h-6 text-red-600" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-red-600">{playlist.title}</p>
                                <p className="text-sm text-gray-500">
                                  Criada: {new Date(playlist.created_at).toLocaleDateString('pt-BR')} às {new Date(playlist.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ));
                        })()}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stats Card */}
          <Card className="border-gray-200">
            <CardContent className="p-6">
              {/* Period Filter */}
              <div className="flex justify-end mb-4">
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                    className="flex items-center gap-2"
                  >
                    {periods.find(p => p.value === period)?.label}
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  {showPeriodDropdown && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[160px]">
                      {periods.map(p => (
                        <div
                          key={p.value}
                          onClick={() => {
                            setPeriod(p.value);
                            setShowPeriodDropdown(false);
                          }}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${period === p.value ? 'bg-blue-50 text-blue-600' : ''}`}
                        >
                          {p.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Info text */}
              {activeTab === 'cds' && (
                <p className="text-sm text-gray-500 mb-2">
                  * CDs lançados na data de hoje (<span className="font-medium">{formattedToday}</span>) não estão contabilizados abaixo.
                </p>
              )}
              <p className="text-sm text-gray-500 mb-1">
                * Dados atualizados até o dia (<span className="font-medium">{formattedYesterday}</span>)
              </p>
              <p className="text-sm text-gray-500 mb-6">
                ** O carregamento pode demorar entre <span className="font-medium">20-30 segundos</span>
              </p>

              {/* Stats Row */}
              <div className="flex items-center gap-8 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">PLAYS</p>
                  <p className="text-2xl font-bold text-red-600">{stats.plays.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">DOWNLOADS</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.downloads.toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Dados por filtro:</span>
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={() => setShowDataTypeDropdown(!showDataTypeDropdown)}
                      className="flex items-center gap-2"
                    >
                      {dataType === 'plays' ? 'PLAYS' : 'DOWNLOADS'}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    {showDataTypeDropdown && (
                      <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[120px]">
                        <div
                          onClick={() => { setDataType('plays'); setShowDataTypeDropdown(false); }}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${dataType === 'plays' ? 'bg-blue-50 text-blue-600' : ''}`}
                        >
                          PLAYS
                        </div>
                        <div
                          onClick={() => { setDataType('downloads'); setShowDataTypeDropdown(false); }}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${dataType === 'downloads' ? 'bg-blue-50 text-blue-600' : ''}`}
                        >
                          DOWNLOADS
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="relative h-64 border-l border-b border-gray-300">
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
                        <Music className="w-6 h-6 text-red-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="border-t border-gray-100 w-full" />
                      ))}
                    </div>

                    {/* Chart bars/line */}
                    <div className="absolute inset-0 flex items-end justify-around px-2">
                      {chartData.map((d, i) => {
                        const value = dataType === 'plays' ? d.plays : d.downloads;
                        const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                        return (
                          <div key={i} className="flex flex-col items-center flex-1">
                            <div
                              className="w-2 bg-blue-500 rounded-t transition-all"
                              style={{ height: `${Math.max(height, 2)}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Line connecting points */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        points={chartData.map((d, i) => {
                          const value = dataType === 'plays' ? d.plays : d.downloads;
                          const x = ((i + 0.5) / chartData.length) * 100;
                          const y = 100 - (maxValue > 0 ? (value / maxValue) * 100 : 0);
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                      {chartData.map((d, i) => {
                        const value = dataType === 'plays' ? d.plays : d.downloads;
                        const x = ((i + 0.5) / chartData.length) * 100;
                        const y = 100 - (maxValue > 0 ? (value / maxValue) * 100 : 0);
                        return (
                          <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="4"
                            fill="#3b82f6"
                          />
                        );
                      })}
                    </svg>
                  </>
                )}
              </div>

              {/* X-axis labels */}
              <div className="flex justify-around mt-2 text-xs text-gray-500">
                {chartData.map((d, i) => (
                  <span key={i}>{d.date}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardNew;
