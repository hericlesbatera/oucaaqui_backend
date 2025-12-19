import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Activity, Users, Music, Eye, Download, Globe } from 'lucide-react';

// Dados de países e coordenadas para visualização
const COUNTRIES_DATA = {
  'BR': { name: 'Brasil', lat: -10.3333, lng: -53.2 },
  'US': { name: 'Estados Unidos', lat: 37.0902, lng: -95.7129 },
  'PT': { name: 'Portugal', lat: 39.3999, lng: -8.2245 },
  'IT': { name: 'Itália', lat: 41.8719, lng: 12.5674 },
  'UK': { name: 'Reino Unido', lat: 55.3781, lng: -3.436 },
  'AU': { name: 'Austrália', lat: -25.2744, lng: 133.7751 },
  'DE': { name: 'Alemanha', lat: 51.1657, lng: 10.4515 },
  'CA': { name: 'Canadá', lat: 56.1304, lng: -106.3468 },
  'AR': { name: 'Argentina', lat: -38.4161, lng: -63.6167 },
  'ES': { name: 'Espanha', lat: 40.463667, lng: -3.74922 }
};

const SiteStatistics = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalArtists: 0,
    totalAlbums: 0,
    totalTracks: 0,
    totalPlays: 0,
    totalDownloads: 0,
    albums: [],
    regions: {}
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7');
  const [filterType, setFilterType] = useState('general'); // 'general' ou 'album'
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [chartType, setChartType] = useState('plays'); // 'plays', 'downloads', 'comparison', 'distribution'

  useEffect(() => {
    loadStatistics();
  }, [timeRange, filterType, selectedAlbum]);

  const loadStatistics = async () => {
    try {
      // Contar usuários
      const { count: userCount } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true });

      // Contar artistas
      const { data: artistCount } = await supabase
        .from('artists')
        .select('id');

      // Contar álbuns
      const { data: albumCount } = await supabase
        .from('albums')
        .select('id');

      // Contar músicas
      const { data: trackCount } = await supabase
        .from('tracks')
        .select('id');

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));

      // Buscar plays
      const { data: plays } = await supabase
        .from('plays')
        .select('album_id, created_at')
        .gte('created_at', daysAgo.toISOString());

      // Buscar downloads
      const { data: downloads } = await supabase
        .from('downloads')
        .select('album_id, created_at')
        .gte('created_at', daysAgo.toISOString());

      // Agrupar plays por álbum
      const albumStats = {};
      plays?.forEach(play => {
        if (!albumStats[play.album_id]) {
          albumStats[play.album_id] = { plays: 0, downloads: 0 };
        }
        albumStats[play.album_id].plays++;
      });

      // Agrupar downloads por álbum
      downloads?.forEach(download => {
        if (!albumStats[download.album_id]) {
          albumStats[download.album_id] = { plays: 0, downloads: 0 };
        }
        albumStats[download.album_id].downloads++;
      });

      // Buscar detalhes dos álbuns
      const { data: albums } = await supabase
        .from('albums')
        .select('id, title, slug, artist_id, play_count, download_count')
        .in('id', Object.keys(albumStats));

      // Buscar artistas dos álbuns
      const artistIds = [...new Set(albums?.map(a => a.artist_id) || [])];
      const { data: artists } = await supabase
        .from('artists')
        .select('id, name, slug')
        .in('id', artistIds);

      const artistMap = {};
      artists?.forEach(a => {
        artistMap[a.id] = a;
      });

      // Combinar dados
      const albumsData = albums?.map(album => ({
        ...album,
        artist: artistMap[album.artist_id],
        plays: albumStats[album.id]?.plays || 0,
        downloads: albumStats[album.id]?.downloads || 0
      })).sort((a, b) => (b.plays + b.downloads) - (a.plays + a.downloads)) || [];

      const totalPlays = Object.values(albumStats).reduce((sum, stats) => sum + stats.plays, 0);
      const totalDownloads = Object.values(albumStats).reduce((sum, stats) => sum + stats.downloads, 0);

      setStats({
        totalUsers: userCount || 0,
        totalArtists: artistCount?.length || 0,
        totalAlbums: albumCount?.length || 0,
        totalTracks: trackCount?.length || 0,
        totalPlays,
        totalDownloads,
        albums: albumsData,
        regions: {} // TODO: implementar geolocalização
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
    setLoading(false);
  };

  const COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'];

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{value.toLocaleString('pt-BR')}</p>
        </div>
        <Icon className={`w-12 h-12 ${color} opacity-20`} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Estatísticas do Site</h2>
          <p className="text-gray-600 mt-1">Análise de uso e dados gerais</p>
        </div>

        {/* Time Range Filter */}
        <div className="flex gap-2">
          {['7', '30', '90'].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                timeRange === days
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Últimos {days} dias
            </button>
          ))}
        </div>
      </div>

      {/* Filter Type */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setFilterType('general');
            setSelectedAlbum(null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filterType === 'general'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setFilterType('album')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filterType === 'album'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Por Álbum
        </button>
      </div>

      {/* Album Filter Dropdown */}
      {filterType === 'album' && (
        <select
          value={selectedAlbum?.id || ''}
          onChange={(e) => {
            const album = stats.albums.find(a => a.id === e.target.value);
            setSelectedAlbum(album || null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Selecione um álbum...</option>
          {stats.albums.map(album => (
            <option key={album.id} value={album.id}>
              {album.title} - {album.artist?.name || 'Artista desconhecido'}
            </option>
          ))}
        </select>
      )}

      {/* Divider */}
      <div className="border-t-2 border-gray-200"></div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          label="Usuários Registrados"
          value={stats.totalUsers}
          color="text-blue-600"
        />
        <StatCard
          icon={Users}
          label="Artistas"
          value={stats.totalArtists}
          color="text-purple-600"
        />
        <StatCard
          icon={Eye}
          label={filterType === 'general' ? 'Total de Plays' : selectedAlbum ? 'Plays' : 'Total de Plays'}
          value={filterType === 'general' ? stats.totalPlays : (selectedAlbum?.plays || 0)}
          color="text-green-600"
        />
        <StatCard
          icon={Download}
          label={filterType === 'general' ? 'Total de Downloads' : selectedAlbum ? 'Downloads' : 'Total de Downloads'}
          value={filterType === 'general' ? stats.totalDownloads : (selectedAlbum?.downloads || 0)}
          color="text-red-600"
        />
      </div>

      {/* Charts Section - Visão Geral */}
      {filterType === 'general' && (
        <div className="space-y-8">
          {/* Section Title */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Análise de Performance</h3>
            <p className="text-gray-600">Visualização dos principais indicadores de uso</p>
          </div>

          {/* Top Row - Key Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Albums Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Top 10 Álbuns - Plays</h3>
            {stats.albums.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.albums.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="plays" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">Sem dados</div>
            )}
          </div>

          {/* Plays vs Downloads Comparison */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Comparação: Plays vs Downloads</h3>
            {stats.albums.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.albums.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="plays" fill="#22c55e" radius={[8, 8, 0, 0]} name="Plays" />
                  <Bar dataKey="downloads" fill="#0ea5e9" radius={[8, 8, 0, 0]} name="Downloads" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">Sem dados</div>
            )}
          </div>
        </div>

          {/* Second Row - Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Downloads Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Top 10 Álbuns - Downloads</h3>
            {stats.albums.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.albums.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="downloads" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">Sem dados</div>
            )}
          </div>

          {/* Distribution Pie */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Distribuição de Acessos (Top 5)</h3>
            {stats.albums.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.albums.slice(0, 5).map(a => ({ 
                      name: a.title, 
                      value: a.plays + a.downloads 
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.albums.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">Sem dados</div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Geolocation Section - Visão Geral */}
      {filterType === 'general' && (
        <div className="space-y-6">
          {/* World Map with Scatter */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-red-600" />
              Público por Região
            </h3>
            <div className="text-sm text-gray-600 mb-4">
              Distribuição global de acessos (simulação - mapa interativo em desenvolvimento)
            </div>
            {stats.albums.length > 0 ? (
              <div className="w-full h-96 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 flex items-center justify-center border-2 border-dashed border-blue-200">
                <div className="text-center">
                  <Globe className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Mapa Interativo em Desenvolvimento</p>
                  <p className="text-sm text-gray-500 mt-1">Será exibido aqui quando dados de geolocalização forem coletados</p>
                </div>
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-500">Sem dados de geolocalização</div>
            )}
          </div>

          {/* Countries Table */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Acessos por País</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">País</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Acessos</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Plays</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Downloads</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">🇧🇷 Brasil</td>
                    <td className="text-right py-3 px-4 text-gray-900 font-bold">{stats.totalPlays + stats.totalDownloads}</td>
                    <td className="text-right py-3 px-4 text-gray-900">{stats.totalPlays}</td>
                    <td className="text-right py-3 px-4 text-gray-900">{stats.totalDownloads}</td>
                    <td className="text-right py-3 px-4"><span className="bg-red-100 text-red-800 px-2 py-1 rounded">100%</span></td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600">🇺🇸 Estados Unidos</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">0%</span></td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600">🇵🇹 Portugal</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">0%</span></td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600">🇦🇷 Argentina</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4 text-gray-600">0</td>
                    <td className="text-right py-3 px-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">0%</span></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-semibold">Outros</td>
                    <td className="text-right py-3 px-4 text-gray-900 font-semibold">0</td>
                    <td className="text-right py-3 px-4 text-gray-900 font-semibold">0</td>
                    <td className="text-right py-3 px-4 text-gray-900 font-semibold">0</td>
                    <td className="text-right py-3 px-4"><span className="bg-gray-200 text-gray-800 px-2 py-1 rounded font-semibold">0%</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
              <p className="font-medium mb-2">ℹ️ Dados de Geolocalização</p>
              <p>Para rastrear de onde vem o público, é necessário implementar geolocalização por IP. Isso será implementado na próxima versão.</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table - Visão Geral */}
      {filterType === 'general' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Detalhes de Acessos por Álbum</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Álbum</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Artista</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Plays</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Downloads</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.albums.slice(0, 20).map((album, index) => {
                  const total = album.plays + album.downloads;
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">
                        <a href={`${window.location.origin}/${album.artist?.slug}/${album.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {album.title}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-gray-900">{album.artist?.name || 'Desconhecido'}</td>
                      <td className="text-right py-3 px-4 text-gray-900 font-medium">
                        {album.plays.toLocaleString('pt-BR')}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900 font-medium">
                        {album.downloads.toLocaleString('pt-BR')}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900 font-bold text-red-600">
                        {total.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Album Specific Charts */}
      {filterType === 'album' && selectedAlbum && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Análise do Álbum - {selectedAlbum.title}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { name: 'Plays', value: selectedAlbum.plays },
              { name: 'Downloads', value: selectedAlbum.downloads }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#dc2626" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Album Specific Details */}
      {filterType === 'album' && selectedAlbum && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedAlbum.title}</h3>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm">Artista</p>
                <p className="text-gray-900 font-medium">{selectedAlbum.artist?.name}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total de Plays</p>
                <p className="text-2xl font-bold text-green-600">{selectedAlbum.plays.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total de Downloads</p>
                <p className="text-2xl font-bold text-blue-600">{selectedAlbum.downloads.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total de Interações</p>
                <p className="text-2xl font-bold text-red-600">{(selectedAlbum.plays + selectedAlbum.downloads).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Link do Álbum</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={`${window.location.origin}/${selectedAlbum.artist?.slug}/${selectedAlbum.slug}`}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/${selectedAlbum.artist?.slug}/${selectedAlbum.slug}`);
                  alert('Link copiado!');
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Copiar Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-medium mb-2">ℹ️ Informações sobre as estatísticas:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Os dados são coletados automaticamente quando usuários fazem plays ou downloads</li>
          <li>Você pode filtrar por período de tempo (7, 30 ou 90 dias)</li>
          <li>Clique em "Por Álbum" para ver estatísticas detalhadas de cada álbum</li>
          <li>Geolocalização de regiões em desenvolvimento</li>
        </ul>
      </div>
    </div>
  );
};

export default SiteStatistics;
