import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, User, ChevronDown, Upload, Disc, Settings, BarChart3, LogOut, Heart, ListMusic } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useImagePreload } from '../../hooks/useImagePreload';
import { mockArtists } from '../../mock';
import { supabase } from '../../lib/supabaseClient';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import AuthModal from '../AuthModal';

// Cache helper para avatar
const AVATAR_CACHE_KEY = 'cached_avatar';
const AVATAR_CACHE_EXPIRY = 1000 * 60 * 60; // 1 hora

const getCachedAvatar = (userId) => {
    try {
        const cached = localStorage.getItem(`${AVATAR_CACHE_KEY}_${userId}`);
        if (cached) {
            const { url, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < AVATAR_CACHE_EXPIRY) {
                return url;
            }
        }
    } catch (e) {
        // Silently ignore localStorage errors
    }
    return null;
};

const setCachedAvatar = (userId, url) => {
    try {
        localStorage.setItem(`${AVATAR_CACHE_KEY}_${userId}`, JSON.stringify({
            url,
            timestamp: Date.now()
        }));
    } catch (e) {
        // Silently ignore localStorage errors
    }
};

const Header = () => {
    const { user, logout, isArtist } = useAuth();
    // Inicializar com cache para evitar flash
    const [artistForUser, setArtistForUser] = useState(() => {
        if (typeof window !== 'undefined' && user?.id) {
            const cachedUrl = getCachedAvatar(user.id);
            if (cachedUrl) return { avatar: cachedUrl };
        }
        return null;
    });
    const [adminAvatar, setAdminAvatar] = useState(() => {
        if (typeof window !== 'undefined' && user?.id) {
            return getCachedAvatar(`admin_${user.id}`);
        }
        return null;
    });
    const [adminName, setAdminName] = useState(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllGenres, setShowAllGenres] = useState(false);
    const [scrollDirection, setScrollDirection] = useState('down');
    const [isGenresOpen, setIsGenresOpen] = useState(false);
    const genreListRef = React.useRef(null);
    
    // Pré-carregar imagens de avatar para evitar flash
    const artistAvatarUrl = artistForUser?.avatar || user?.avatar || user?.user_metadata?.avatar_url;
    const { imageUrl: preloadedArtistAvatar } = useImagePreload(artistAvatarUrl, '/images/default-avatar.png');
    const { imageUrl: preloadedAdminAvatar } = useImagePreload(adminAvatar, '/images/default-avatar.png');

    // Função de logout que verifica se está em um painel
    const handleLogout = () => {
        const currentPath = location.pathname;
        logout();
        
        // Redirecionar para home apenas se estiver em painel de artista ou usuário
        if (currentPath.startsWith('/artist/') || currentPath === '/user/panel') {
            navigate('/');
        }
    };

    const isAdmin = user?.isAdmin === true;

    const allGenres = [
        { name: 'Forró', slug: 'forro' },
        { name: 'Arrocha', slug: 'arrocha' },
        { name: 'Piseiro', slug: 'piseiro' },
        { name: 'Arrochadeira', slug: 'arrochadeira' },
        { name: 'Pagode', slug: 'pagode' },
        { name: 'Sertanejo', slug: 'sertanejo' },
        { name: 'Brega Funk', slug: 'brega-funk' },
        { name: 'Variados', slug: 'variados' },
        { name: 'Samba', slug: 'samba' },
        { name: 'Funk', slug: 'funk' },
        { name: 'Axé', slug: 'axe' },
        { name: 'Reggae', slug: 'reggae' },
        { name: 'Brega', slug: 'brega' },
        { name: 'Gospel', slug: 'gospel' },
        { name: 'Rap/Hip-Hop', slug: 'rap-hip-hop' },
        { name: 'Pop', slug: 'pop' },
        { name: 'MPB', slug: 'mpb' },
        { name: 'Rock', slug: 'rock' },
        { name: 'Eletrônica', slug: 'eletronica' },
        { name: 'Trap', slug: 'trap' },
        { name: 'Frevo', slug: 'frevo' }
    ];

    const visibleGenres = showAllGenres ? allGenres : allGenres.slice(0, 14);

    useEffect(() => {
        const loadArtist = async () => {
            if (user?.id && isArtist) {
                // Verificar cache primeiro
                const cached = getCachedAvatar(user.id);
                if (cached && !artistForUser?.id) {
                    setArtistForUser(prev => ({ ...prev, avatar: cached }));
                }
                
                const { data: supabaseArtist } = await supabase
                    .from('artists')
                    .select('id, slug, name, avatar_url')
                    .eq('id', user.id)
                    .maybeSingle();

                if (supabaseArtist) {
                    const avatarUrl = supabaseArtist.avatar_url || '/images/default-avatar.png';
                    setCachedAvatar(user.id, avatarUrl);
                    setArtistForUser({
                        id: supabaseArtist.id,
                        slug: supabaseArtist.slug,
                        name: supabaseArtist.name,
                        avatar: avatarUrl
                    });
                } else {
                    const mockArtist = mockArtists.find(a => a.userId === user.id || String(a.userId) === String(user.id));
                    if (mockArtist) setArtistForUser(mockArtist);
                }
            }
        };
        loadArtist();
    }, [user?.id, isArtist]);

    useEffect(() => {
        const loadAdminAvatar = async () => {
            if (user?.id && isAdmin) {
                // Verificar cache primeiro
                const cached = getCachedAvatar(`admin_${user.id}`);
                if (cached && !adminAvatar) {
                    setAdminAvatar(cached);
                }
                
                const { data } = await supabase
                    .from('admin_users')
                    .select('avatar_url')
                    .eq('id', user.id)
                    .maybeSingle();

                if (data?.avatar_url) {
                    setCachedAvatar(`admin_${user.id}`, data.avatar_url);
                    setAdminAvatar(data.avatar_url);
                } else if (user?.avatar) {
                    setAdminAvatar(user.avatar);
                }
            }
        };
        loadAdminAvatar();
    }, [user?.id, isAdmin, user?.avatar]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${searchQuery}`);
        }
    };

    return (
        <>
        <header className="hidden md:block bg-red-600 shadow-lg sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-16 gap-6">
                    {/* Logo */}
                    <Link to="/" className="flex items-center flex-shrink-0">
                        <img src="/images/Logo-escutai.png" alt="Escutaí" className="max-h-12 w-auto h-auto" />
                    </Link>

                    {/* Navigation */}
                     <nav className="hidden md:flex items-center space-x-6">
                         <Link to="/lancamentos" className="text-white hover:text-gray-200 font-medium transition-colors">
                             Lançamentos
                         </Link>
                         <Link to="/artists" className="text-white hover:text-gray-200 font-medium transition-colors">
                             Artistas
                         </Link>
                         <Link to="/sobre" className="text-white hover:text-gray-200 font-medium transition-colors">
                             Sobre
                         </Link>
                        <DropdownMenu modal={false} onOpenChange={(open) => { 
                            setIsGenresOpen(open);
                            if (!open) setShowAllGenres(false); 
                        }}>
                            <DropdownMenuTrigger className="text-white hover:text-gray-200 font-medium transition-colors flex items-center gap-1">
                                Gêneros <ChevronDown className={`w-4 h-4 translate-y-0.5 transition-transform duration-200 ${isGenresOpen ? 'rotate-180' : ''}`} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white w-48">
                                {visibleGenres.map((genre) => (
                                    <DropdownMenuItem
                                        key={genre.slug}
                                        className="cursor-pointer hover:bg-red-50 hover:text-red-600 p-0"
                                        asChild
                                    >
                                        <Link
                                            to={`/genero/${genre.slug}`}
                                            className="w-full px-2 py-1.5 block"
                                        >
                                            {genre.name}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                                {!showAllGenres && allGenres.length > 14 && (
                                    <div
                                        onMouseEnter={() => setShowAllGenres(true)}
                                        className="w-full py-2 flex items-center justify-center text-gray-400 border-t cursor-pointer hover:text-red-600 transition-colors"
                                    >
                                        <ChevronDown className="w-5 h-5" />
                                    </div>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </nav>

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="hidden lg:flex items-center flex-1 max-w-sm">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <Input
                                type="text"
                                placeholder="Busque por artistas, álbuns..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-3 py-2 bg-white border-0 text-gray-900 placeholder:text-gray-500 rounded-full shadow-sm focus:ring-2 focus:ring-white/50"
                            />
                        </div>
                    </form>

                    {/* User Actions */}
                    <div className="flex items-center space-x-4">
                        {user && <NotificationDropdown />}
                        {user ? (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors">
                                        <img
                                            src={isAdmin ? preloadedAdminAvatar : preloadedArtistAvatar}
                                            alt={isAdmin ? 'Administrador' : (artistForUser?.name || user?.name)}
                                            className="w-8 h-8 rounded-full object-cover"
                                            loading="eager"
                                            decoding="async"
                                            onError={(e) => {
                                                if (e.target.src !== '/images/default-avatar.png') {
                                                    e.target.src = '/images/default-avatar.png';
                                                }
                                            }}
                                        />
                                        <span className="text-white font-medium hidden md:block">{isAdmin ? (adminName || 'Ouça Aqui') : user.name}</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-white w-80 sm:w-96">
                                    {isAdmin ? (
                                        <>
                                             <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer flex items-center gap-3 py-2">
                                                 <Settings className="w-5 h-5 text-gray-500" />
                                                 <span>Painel Admin</span>
                                             </DropdownMenuItem>
                                             <div className="border-t border-gray-200 my-2"></div>
                                             <DropdownMenuItem onClick={handleLogout} className="cursor-pointer flex items-center gap-3 py-2 text-red-600">
                                                 <LogOut className="w-5 h-5" />
                                                 <span>Sair</span>
                                             </DropdownMenuItem>
                                        </>
                                        ) : isArtist ? (
                                       <>
                                            <DropdownMenuItem onClick={() => navigate(`/${artistForUser?.slug || artistForUser?.id || 'a1'}`)} className="cursor-pointer flex items-center gap-3 py-2">
                                                <User className="w-5 h-5 text-gray-500" />
                                                <span>Meu Perfil</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/artist/upload')} className="cursor-pointer flex items-center gap-3 py-2">
                                                <Upload className="w-5 h-5 text-gray-500" />
                                                <span>Novo Upload</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/artist/albums')} className="cursor-pointer flex items-center gap-3 py-2">
                                                <Disc className="w-5 h-5 text-gray-500" />
                                                <span>Meus Álbuns</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/artist/dashboard')} className="cursor-pointer flex items-center gap-3 py-2">
                                                <BarChart3 className="w-5 h-5 text-gray-500" />
                                                <span>Estatísticas</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/artist/settings')} className="cursor-pointer flex items-center gap-3 py-2">
                                                <Settings className="w-5 h-5 text-gray-500" />
                                                <span>Configurações</span>
                                            </DropdownMenuItem>
                                            <div className="border-t border-gray-200 my-2"></div>
                                            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer flex items-center gap-3 py-2 text-red-600">
                                                <LogOut className="w-5 h-5" />
                                                <span>Sair</span>
                                            </DropdownMenuItem>
                                       </>
                                    ) : (
                                       <>
                                            <DropdownMenuItem onClick={() => navigate('/user/panel')} className="cursor-pointer flex items-center gap-3 py-2">
                                                <Settings className="w-5 h-5 text-gray-500" />
                                                <span>Meu Painel</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/favorites')} className="cursor-pointer flex items-center gap-3 py-2">
                                                <Heart className="w-5 h-5 text-gray-500" />
                                                <span>Favoritos</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate('/playlists')} className="cursor-pointer flex items-center gap-3 py-2">
                                                <ListMusic className="w-5 h-5 text-gray-500" />
                                                <span>Playlists</span>
                                            </DropdownMenuItem>
                                            <div className="border-t border-gray-200 my-2"></div>
                                            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer flex items-center gap-3 py-2 text-red-600">
                                                <LogOut className="w-5 h-5" />
                                                <span>Sair</span>
                                            </DropdownMenuItem>
                                            </>
                                            )}
                                            </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <Button
                                    onClick={() => setIsAuthModalOpen(true)}
                                    variant="outline"
                                    className="border-white text-white hover:bg-white hover:text-red-600"
                                >
                                    Entrar
                                </Button>
                                <Button
                                    onClick={() => setIsAuthModalOpen(true)}
                                    className="bg-white text-red-600 hover:bg-gray-100"
                                >
                                    Cadastrar
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>

        {/* Auth Modal */}
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </>
    );
};

export default Header;