import React, { useState } from 'react';
import { X, Eye, EyeOff, Loader2, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { toast } from '../hooks/use-toast';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

const AuthModal = ({ isOpen, onClose }) => {
    const [loadingLogin, setLoadingLogin] = useState(false);
    const [loadingSignup, setLoadingSignup] = useState(false);
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
    
    const { loginWithGoogle } = useAuth();

    const termosDeUso = (
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>AVISO LEGAL</div>
            <p>O site "Ouça Aqui", oferece uma plataforma para compartilhamento e divulgação de conteúdo musical. Ao acessar ou utilizar nossos serviços, você concorda com os Termos de Uso e a Política de Privacidade, os quais podem ser alterados periodicamente. Recomendamos que você os revise regularmente.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>1. Uso do Serviço</div>
            <p>Usuários: Podem acessar, ouvir, compartilhar, e criar suas playlists no "Ouça Aqui".</p>
            <p>Visitantes: Podem acessar o conteúdo disponível para visualização e streaming, sem a capacidade de realizar upload.
            O uso da plataforma está sujeito à criação de uma conta, sendo de sua responsabilidade manter a segurança da mesma.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>2. Tipos de Conta e Funcionalidades</div>
            <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 5 }}>Usuário:</div>
            <p>Pode acessar e ouvir músicas e conteúdos disponíveis na plataforma.</p>
            <p>Pode compartilhar músicas com outros usuários e criar suas próprias playlists.</p>
            <p>Não tem permissão para fazer upload de conteúdo.</p>

            <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 5 }}>Artista:</div>
            <p>Pode acessar e ouvir músicas, assim como os usuários.</p>
            <p>Tem a permissão para compartilhar músicas com outros usuários.</p>
            <p>Pode fazer upload de músicas e outros conteúdos, disponibilizando-os para streaming e download pelos usuários.</p>
            <p>Tem a possibilidade de gerenciar e editar seus próprios conteúdos dentro da plataforma.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>3. Direitos e Responsabilidades</div>
            <p>Você é o único responsável pelo conteúdo que enviar. Ao fazer upload de conteúdo, concede ao "Ouça Aqui" uma licença não exclusiva para exibição, reprodução e distribuição do conteúdo através de nossa plataforma.</p>
            <p>O conteúdo enviado não pode violar direitos de terceiros, incluindo direitos autorais, marcas registradas, privacidade ou qualquer outra legislação vigente.</p>
            <p>O "Ouça Aqui" reserva-se o direito de remover qualquer conteúdo que infrinja as leis ou que seja considerado inadequado.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>4. Modificação do Serviço</div>
            <p>O "Ouça Aqui" pode, a qualquer momento, modificar ou descontinuar serviços, funcionalidades ou recursos sem aviso prévio, não sendo responsável por compensações aos usuários.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>5. Propriedade Intelectual</div>
            <p>O conteúdo do "Ouça Aqui", incluindo sua marca, design e funcionalidades, são protegidos por direitos autorais e não podem ser reproduzidos sem autorização prévia.</p>
            <p>O conteúdo publicado por usuários é de sua propriedade, mas você concede ao "Ouça Aqui" uma licença para usá-lo conforme necessário para operar a plataforma.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>6. Limitação de Responsabilidade</div>
            <p>O "Ouça Aqui" não se responsabiliza por danos diretos, indiretos, incidentais ou consequenciais relacionados ao uso da plataforma. O serviço é fornecido "como está", sem garantias expressas ou implícitas.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>7. Encerramento de Conta</div>
            <p>Você pode encerrar sua conta a qualquer momento. O "Ouça Aqui" também pode suspender ou encerrar sua conta caso haja violação dos Termos de Uso.</p>

            <div style={{ fontWeight: 700, marginTop: 15, marginBottom: 10 }}>8. Foro</div>
            <p>Qualquer disputa relacionada a estes Termos de Uso será resolvida no foro da cidade de São Vicente Férrer, Pernambuco, com exclusão de qualquer outro foro.</p>
        </div>
    );
    
    // Tipo de usuário e etapa
    const [userType, setUserType] = useState('user');
    const [signupStep, setSignupStep] = useState(() => {
        // Mobile começa em login (signupStep 4), desktop começa em cadastro (signupStep 1)
        return typeof window !== 'undefined' && window.innerWidth < 768 ? 4 : 1;
    }); // 1: Basic info, 2: Artist info (if artist), 4: Login
    const [loginStep, setLoginStep] = useState('login'); // 'login', 'reset', 'resetSuccess'

    // Login
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Cadastro - Step 1 (Basic Info)
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);

    // Cadastro - Step 2 (Artist Info)
    const [artistName, setArtistName] = useState('');
    const [artistSlug, setArtistSlug] = useState('');
    const [artistSlugError, setArtistSlugError] = useState('');
    const [artistCidade, setArtistCidade] = useState('');
    const [artistEstado, setArtistEstado] = useState('');
    const [artistGenero, setArtistGenero] = useState('');
    const [artistEstiloMusical, setArtistEstiloMusical] = useState('');
    const [acceptTermsArtist, setAcceptTermsArtist] = useState(false);

    // Modal de termos
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [currentTermsFor, setCurrentTermsFor] = useState('user');
    const [termsReadByUser, setTermsReadByUser] = useState(false);
    const [termsReadByArtist, setTermsReadByArtist] = useState(false);

    // Reset de senha
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    // Estados do Brasil
    const estadosBrasil = [
        { value: 'ac', label: 'Acre' },
        { value: 'al', label: 'Alagoas' },
        { value: 'ap', label: 'Amapá' },
        { value: 'am', label: 'Amazonas' },
        { value: 'ba', label: 'Bahia' },
        { value: 'ce', label: 'Ceará' },
        { value: 'df', label: 'Distrito Federal' },
        { value: 'es', label: 'Espírito Santo' },
        { value: 'go', label: 'Goiás' },
        { value: 'ma', label: 'Maranhão' },
        { value: 'mt', label: 'Mato Grosso' },
        { value: 'ms', label: 'Mato Grosso do Sul' },
        { value: 'mg', label: 'Minas Gerais' },
        { value: 'pa', label: 'Pará' },
        { value: 'pb', label: 'Paraíba' },
        { value: 'pr', label: 'Paraná' },
        { value: 'pe', label: 'Pernambuco' },
        { value: 'pi', label: 'Piauí' },
        { value: 'rj', label: 'Rio de Janeiro' },
        { value: 'rn', label: 'Rio Grande do Norte' },
        { value: 'rs', label: 'Rio Grande do Sul' },
        { value: 'ro', label: 'Rondônia' },
        { value: 'rr', label: 'Roraima' },
        { value: 'sc', label: 'Santa Catarina' },
        { value: 'sp', label: 'São Paulo' },
        { value: 'se', label: 'Sergipe' },
        { value: 'to', label: 'Tocantins' }
    ];

    // Ícone SVG reutilizável
    const UserIcon = ({ className = "w-5 h-5" }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
    );

    const EmailIcon = ({ className = "w-5 h-5" }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
        </svg>
    );

    const LockIcon = ({ className = "w-5 h-5" }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
    );

    // Função para gerar slug
    const slugify = (value) => {
        if (!value) return '';
        return value
            .toString()
            .normalize('NFKD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s_-]+/g, '')
            .replace(/^-+|-+$/g, '');
    };

    const handleArtistNameChange = (value) => {
        setArtistName(value);
        const newSlug = slugify(value);
        setArtistSlug(newSlug);
        setArtistSlugError('');
    };

    const checkSlugAvailability = async (slug) => {
        if (!slug) return false;
        const { data } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', slug)
            .single();
        return !data;
    };

    const openTermsModal = (type) => {
        setCurrentTermsFor(type);
        setShowTermsModal(true);
    };

    const acceptTermsModal = () => {
        if (currentTermsFor === 'user') {
            setTermsReadByUser(true);
            setAcceptTerms(true);
        } else {
            setTermsReadByArtist(true);
            setAcceptTermsArtist(true);
        }
        setShowTermsModal(false);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        
        if (!resetEmail) {
            toast({
                title: 'Erro',
                description: 'Digite seu email',
                variant: 'destructive'
            });
            return;
        }

        setResetLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) throw error;

            toast({
                title: 'Sucesso',
                description: 'Verifique seu email para redefinir a senha'
            });

            setLoginStep('resetSuccess');
        } catch (error) {
            toast({
                title: 'Erro',
                description: error.message || 'Erro ao enviar email de reset',
                variant: 'destructive'
            });
        } finally {
            setResetLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        
        if (!loginEmail || !loginPassword) {
            toast({
                title: 'Erro',
                description: 'Preencha todos os campos',
                variant: 'destructive'
            });
            return;
        }

        setLoadingLogin(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword
            });

            if (error) throw error;

            // toast({
            //     title: 'Sucesso',
            //     description: 'Login realizado com sucesso!'
            // });

            setLoginEmail('');
            setLoginPassword('');
            onClose();
        } catch (error) {
            toast({
                title: 'Erro ao fazer login',
                description: error.message || 'Verifique suas credenciais',
                variant: 'destructive'
            });
        } finally {
            setLoadingLogin(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle();
        } catch (error) {
            toast({
                title: 'Erro',
                description: 'Erro ao fazer login com Google',
                variant: 'destructive'
            });
        }
    };

    const handleSignupStep1 = async (e) => {
        e.preventDefault();

        if (!signupName || !signupEmail || !signupPassword || !signupConfirmPassword) {
            toast({
                title: 'Erro',
                description: 'Preencha todos os campos',
                variant: 'destructive'
            });
            return;
        }

        if (!acceptTerms) {
            toast({
                title: 'Erro',
                description: 'Você precisa aceitar os termos de uso',
                variant: 'destructive'
            });
            return;
        }

        if (signupPassword !== signupConfirmPassword) {
            toast({
                title: 'Erro',
                description: 'As senhas não coincidem',
                variant: 'destructive'
            });
            return;
        }

        if (signupPassword.length < 6) {
            toast({
                title: 'Erro',
                description: 'A senha deve ter no mínimo 6 caracteres',
                variant: 'destructive'
            });
            return;
        }

        if (userType === 'artist') {
            setSignupStep(2);
        } else {
            completeSignup();
        }
    };

    const handleSignupStep2 = async (e) => {
        e.preventDefault();

        if (!artistName || !artistSlug || !artistCidade || !artistEstado || !artistGenero || !artistEstiloMusical) {
            toast({
                title: 'Erro',
                description: 'Preencha todos os campos obrigatórios',
                variant: 'destructive'
            });
            return;
        }

        // Verificar disponibilidade do slug
        const isAvailable = await checkSlugAvailability(artistSlug);
        if (!isAvailable) {
            setArtistSlugError('Este endereço já está em uso');
            return;
        }

        completeSignup();
    };

    const completeSignup = async () => {
        setLoadingSignup(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: signupEmail,
                password: signupPassword,
                options: {
                    data: {
                        full_name: signupName,
                        user_type: userType,
                        cidade: userType === 'user' ? '' : artistCidade,
                        estado: userType === 'user' ? '' : artistEstado,
                        genero: userType === 'user' ? '' : artistGenero,
                        estilo_musical: userType === 'artist' ? artistEstiloMusical : undefined
                    }
                }
            });

            if (authError) throw authError;

            // Se for artista, criar perfil na tabela artists
            if (userType === 'artist' && authData?.user?.id) {
                const { error: profileError } = await supabase
                    .from('artists')
                    .insert({
                        id: authData.user.id,
                        name: artistName,
                        slug: artistSlug,
                        email: signupEmail,
                        cidade: artistCidade,
                        estado: artistEstado,
                        genero: artistGenero,
                        estilo_musical: artistEstiloMusical,
                        bio: '',
                        avatar_url: '',
                        cover_url: '',
                        followers_count: 0,
                        is_verified: false
                    });

                if (profileError) {
                    console.error('Erro ao criar perfil:', profileError);
                }
            }

            toast({
                title: 'Cadastro realizado!',
                description: 'Verifique seu email para confirmar a conta'
            });

            // Mostra tela de sucesso
            setSignupStep(3);
        } catch (error) {
            toast({
                title: 'Erro ao cadastrar',
                description: error.message || 'Tente novamente mais tarde',
                variant: 'destructive'
            });
        } finally {
            setLoadingSignup(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div 
                className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onClose();
                    }
                }}
            >
                {/* Versão Mobile */}
                <div className="md:hidden w-full max-w-full">
                    {loginStep === 'reset' ? (
                        // RESET DE SENHA - Mobile
                        <div className="bg-white rounded-lg shadow-2xl overflow-hidden relative">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full z-20 transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-600" />
                            </button>

                            <div className="p-6 bg-gray-50 flex flex-col">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Recuperar Senha</h2>
                                <p className="text-sm text-gray-600 mb-6">
                                    Insira o seu e-mail de cadastro e enviaremos um link para recuperar a senha
                                </p>

                                {loginStep === 'resetSuccess' ? (
                                    <div className="text-center py-12">
                                        <div style={{ fontSize: 60, marginBottom: 16, color: '#22c55e' }}>✓</div>
                                        <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>Recuperação de senha</p>
                                        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Email enviado com sucesso!</p>
                                        <button
                                            onClick={() => {
                                                setLoginStep('login');
                                                setResetEmail('');
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-full transition-colors text-sm"
                                        >
                                            OK
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleResetPassword} className="space-y-4 flex-1 flex flex-col">
                                        <div className="relative">
                                            <svg className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="4"></circle>
                                                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                                            </svg>
                                            <input
                                                type="email"
                                                placeholder="E-mail"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={resetLoading}
                                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-full transition-colors flex items-center justify-center gap-2 text-sm mt-auto"
                                        >
                                            {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            ENVIAR LINK
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLoginStep('login');
                                                setResetEmail('');
                                            }}
                                            className="text-red-600 hover:text-red-700 text-sm font-semibold"
                                        >
                                            Voltar ao login
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    ) : (
                        // LOGIN/SIGNUP - Mobile com abas
                        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                            {/* Abas */}
                            <div className="flex border-b border-gray-200">
                                <button
                                    onClick={() => setSignupStep(1)}
                                    className={`flex-1 py-3 font-semibold text-sm transition-colors ${
                                        signupStep === 1
                                            ? 'text-red-600 border-b-2 border-red-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Cadastrar
                                </button>
                                <button
                                    onClick={() => setSignupStep(4)}
                                    className={`flex-1 py-3 font-semibold text-sm transition-colors ${
                                        signupStep === 4
                                            ? 'text-red-600 border-b-2 border-red-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Entrar
                                </button>
                            </div>

                            {/* Conteúdo */}
                            <div className="p-6 bg-white flex flex-col">
                                {signupStep === 1 ? (
                                    // CADASTRO - Mobile
                                    <>
                                        <div className="mb-6">
                                            <div className="flex gap-4 mb-4">
                                                <button
                                                    onClick={() => setUserType('user')}
                                                    className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                                                        userType === 'user'
                                                            ? 'bg-red-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    Usuário
                                                </button>
                                                <button
                                                    onClick={() => setUserType('artist')}
                                                    className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                                                        userType === 'artist'
                                                            ? 'bg-red-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    Artista
                                                </button>
                                            </div>
                                        </div>

                                        <form onSubmit={handleSignupStep1} className="space-y-3 flex-1 flex flex-col">
                                            <div className="relative">
                                                <UserIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Nome completo"
                                                    value={signupName}
                                                    onChange={(e) => setSignupName(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                                />
                                            </div>

                                            <div className="relative">
                                                <EmailIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
                                                <input
                                                    type="email"
                                                    placeholder="E-mail"
                                                    value={signupEmail}
                                                    onChange={(e) => setSignupEmail(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                                />
                                            </div>

                                            <div className="relative">
                                                <LockIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
                                                <input
                                                    type={showSignupPassword ? 'text' : 'password'}
                                                    placeholder="Senha"
                                                    value={signupPassword}
                                                    onChange={(e) => setSignupPassword(e.target.value)}
                                                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                >
                                                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>

                                            <div className="relative">
                                                <LockIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
                                                <input
                                                    type={showSignupConfirmPassword ? 'text' : 'password'}
                                                    placeholder="Confirmar Senha"
                                                    value={signupConfirmPassword}
                                                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                >
                                                    {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="acceptTermsMobile"
                                                    checked={acceptTerms}
                                                    onChange={(e) => {
                                                        if (!termsReadByUser) {
                                                            openTermsModal('user');
                                                        } else {
                                                            setAcceptTerms(e.target.checked);
                                                        }
                                                    }}
                                                    className="mt-1 cursor-pointer"
                                                />
                                                <label htmlFor="acceptTermsMobile" className="text-xs text-gray-700">
                                                    Li e aceito os{' '}
                                                    <span 
                                                        className="text-red-600 underline cursor-pointer hover:text-red-700"
                                                        onClick={() => openTermsModal('user')}
                                                    >
                                                        termos de uso
                                                    </span>
                                                </label>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loadingSignup}
                                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-full transition-colors flex items-center justify-center gap-2 mt-auto text-sm"
                                            >
                                                {loadingSignup && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {userType === 'artist' ? 'PRÓXIMO' : 'CADASTRAR'}
                                            </button>
                                        </form>
                                    </>
                                ) : signupStep === 4 ? (
                                    // LOGIN - Mobile
                                    <form onSubmit={handleLogin} className="space-y-4 flex-1 flex flex-col">
                                        <div className="relative">
                                            <EmailIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
                                            <input
                                                type="email"
                                                placeholder="E-mail"
                                                value={loginEmail}
                                                onChange={(e) => setLoginEmail(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                            />
                                        </div>

                                        <div className="relative">
                                            <LockIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
                                            <input
                                                type={showLoginPassword ? 'text' : 'password'}
                                                placeholder="Senha"
                                                value={loginPassword}
                                                onChange={(e) => setLoginPassword(e.target.value)}
                                                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                            >
                                                {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loadingLogin}
                                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-full transition-colors flex items-center justify-center gap-2 mt-auto text-sm"
                                        >
                                            {loadingLogin && <Loader2 className="w-4 h-4 animate-spin" />}
                                            ENTRAR
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={() => setLoginStep('reset')}
                                            className="text-red-600 hover:text-red-700 text-xs font-semibold text-center"
                                        >
                                            ESQUECI A SENHA?
                                        </button>

                                        <div className="relative my-3">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-gray-300"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-white px-2 text-gray-500">Ou</span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleGoogleLogin}
                                            className="w-full bg-white hover:bg-gray-100 text-black border border-gray-300 font-semibold py-2.5 rounded-full transition-colors flex items-center justify-center gap-2 text-sm"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                            </svg>
                                            Google
                                        </button>
                                    </form>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>

                {/* Versão Desktop */}
                <div className="hidden md:flex md:items-center md:justify-center w-full h-full">
                <div className={`bg-white rounded-lg shadow-2xl overflow-hidden relative transition-all ${
                    loginStep === 'reset' ? 'w-full max-w-xl' : signupStep === 2 ? 'w-full max-w-lg' : signupStep === 3 ? 'w-full max-w-lg' : 'w-full max-w-4xl'
                } max-h-[85vh] mx-auto overflow-y-auto`}>
                    {/* Botão fechar */}
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 p-1.5 hover:bg-gray-100 rounded-full z-20 transition-colors bg-white shadow-sm"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>

                    {/* VISTA PRINCIPAL - Login e Cadastro abertos */}
                     {loginStep === 'reset' ? (
                        // RESET DE SENHA - compacto
                        <div className="bg-white p-5 flex flex-col justify-center items-center w-full">
                            <div className="w-full pt-6">
                                {loginStep === 'resetSuccess' ? (
                                    <div className="text-center">
                                        <div className="text-5xl mb-4 text-green-500">✓</div>
                                        <p className="text-lg font-semibold text-gray-900 mb-2">Recuperação de senha</p>
                                        <p className="text-sm text-gray-600 mb-6">Email de recuperação enviado com sucesso!</p>
                                        <button
                                            onClick={() => {
                                                setLoginStep('login');
                                                setResetEmail('');
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-2 rounded-full transition-colors text-sm"
                                        >
                                            OK
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-bold text-gray-900 mb-3 text-center">Recuperar Senha</h2>
                                        <p className="text-sm text-gray-600 mb-4 text-center">
                                            Insira seu e-mail e enviaremos um link para recuperar a senha
                                        </p>
                                        <form onSubmit={handleResetPassword} className="space-y-3 w-full">
                                            <div className="relative">
                                                <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                                                    <circle cx="12" cy="12" r="4"></circle>
                                                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                                                </svg>
                                                <input
                                                    type="email"
                                                    placeholder="E-mail"
                                                    value={resetEmail}
                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={resetLoading}
                                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 rounded-full transition-colors flex items-center justify-center gap-2 text-sm"
                                            >
                                                {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                                ENVIAR LINK
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLoginStep('login');
                                                    setResetEmail('');
                                                }}
                                                className="w-full text-gray-600 hover:text-gray-700 text-sm font-semibold"
                                            >
                                                Voltar ao login
                                            </button>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : signupStep === 1 ? (
                        <div className="grid grid-cols-2">
                            {/* ESQUERDA - Cadastro */}
                            <div className="bg-white p-4 flex flex-col justify-center border-r border-gray-200 overflow-y-auto">
                                <h2 className="text-lg font-bold text-gray-900 mb-1">Cadastre-se GRÁTIS</h2>
                                <p className="text-gray-600 text-xs mb-3">Crie sua conta para acessar a plataforma</p>

                                {/* Seletor de Tipo */}
                                <div className="mb-4">
                                    <p className="text-gray-700 font-semibold text-xs mb-2">Tipo de conta:</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setUserType('user')}
                                            className={`flex-1 px-3 py-2 rounded-lg font-bold text-xs transition-colors ${
                                                userType === 'user'
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Usuário
                                        </button>
                                        <button
                                            onClick={() => setUserType('artist')}
                                            className={`flex-1 px-3 py-2 rounded-lg font-bold text-xs transition-colors ${
                                                userType === 'artist'
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            Artista
                                        </button>
                                    </div>
                                </div>

                                {/* Formulário Etapa 1 */}
                                <form onSubmit={handleSignupStep1} className="space-y-2">
                                    <div className="relative">
                                        <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Nome completo"
                                            value={signupName}
                                            onChange={(e) => setSignupName(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                        />
                                    </div>

                                    <div className="relative">
                                        <EmailIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                        <input
                                            type="email"
                                            placeholder="E-mail"
                                            value={signupEmail}
                                            onChange={(e) => setSignupEmail(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                        />
                                    </div>

                                    <div className="relative">
                                        <LockIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                        <input
                                            type={showSignupPassword ? 'text' : 'password'}
                                            placeholder="Senha"
                                            value={signupPassword}
                                            onChange={(e) => setSignupPassword(e.target.value)}
                                            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSignupPassword(!showSignupPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <LockIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                        <input
                                            type={showSignupConfirmPassword ? 'text' : 'password'}
                                            placeholder="Confirmar Senha"
                                            value={signupConfirmPassword}
                                            onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    <div className="flex items-start gap-2">
                                         <input
                                              type="checkbox"
                                              id="acceptTerms"
                                              checked={acceptTerms}
                                              onChange={(e) => {
                                                  if (!termsReadByUser) {
                                                      openTermsModal('user');
                                                  } else {
                                                      setAcceptTerms(e.target.checked);
                                                  }
                                              }}
                                              className="mt-0.5 cursor-pointer"
                                          />
                                         <label htmlFor="acceptTerms" className="text-[11px] text-gray-700">
                                             Li e aceito os{' '}
                                             <span 
                                                 className="text-red-600 underline cursor-pointer hover:text-red-700"
                                                 onClick={() => openTermsModal('user')}
                                             >
                                                 termos de uso
                                             </span>
                                             {!termsReadByUser && <span className="text-gray-500 ml-1">(Abra para ler)</span>}
                                         </label>
                                     </div>

                                    <button
                                        type="submit"
                                        disabled={loadingSignup}
                                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 rounded-full transition-colors flex items-center justify-center gap-2 mt-2 text-sm"
                                    >
                                        {loadingSignup && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {userType === 'artist' ? 'PRÓXIMO' : 'CADASTRAR'}
                                    </button>
                                </form>
                            </div>

                            {/* DIREITA - Login */}
                            <div className="bg-white p-4 flex flex-col overflow-y-auto">
                                <h2 className="text-lg font-bold text-gray-900 mb-1">Já tenho uma conta</h2>
                                <p className="text-gray-600 text-xs mb-3">&nbsp;</p>

                                {/* Espaçador para alinhar com o cadastro */}
                                <div className="mb-3"></div>

                                <form onSubmit={handleLogin} className="space-y-2">
                                    <div className="relative">
                                        <EmailIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                        <input
                                            type="email"
                                            placeholder="E-mail ou usuário"
                                            value={loginEmail}
                                            onChange={(e) => setLoginEmail(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <div className="relative">
                                            <LockIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                            <input
                                                type={showLoginPassword ? 'text' : 'password'}
                                                placeholder="Senha"
                                                value={loginPassword}
                                                onChange={(e) => setLoginPassword(e.target.value)}
                                                className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                            >
                                                {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loadingLogin}
                                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 rounded-full transition-colors flex items-center justify-center gap-2 mt-2 text-sm"
                                    >
                                        {loadingLogin && <Loader2 className="w-4 h-4 animate-spin" />}
                                        ENTRAR
                                    </button>
                                </form>

                                <button 
                                    type="button"
                                    onClick={() => setLoginStep('reset')}
                                    className="text-red-600 hover:text-red-700 text-xs mt-2 font-semibold text-left"
                                >
                                    ESQUECI A SENHA?
                                </button>

                                <div className="relative my-3">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white px-2 text-gray-500">Ou</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    className="w-full bg-white hover:bg-gray-100 text-black border border-gray-300 font-semibold py-2 rounded-full transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    Google
                                </button>
                            </div>
                        </div>
                    ) : signupStep === 2 ? (
                        // SIGNUP STEP 2 - Artist Info
                        <div className="bg-white p-4 sm:p-6 min-h-auto max-w-2xl mx-auto max-h-[80vh] overflow-y-auto">
                            {/* Stepper Visual - Compacto */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs">✓</div>
                                    <p className="text-[10px] text-gray-600 text-center">Básicas</p>
                                </div>
                                <div className="flex-1 h-0.5 bg-red-600 mx-2"></div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs ${signupStep >= 2 ? 'bg-green-500' : 'bg-red-600'}`}>
                                        {signupStep >= 3 ? '✓' : '2'}
                                    </div>
                                    <p className="text-[10px] text-gray-600 text-center">Artista</p>
                                </div>
                                <div className={`flex-1 h-0.5 mx-2 ${signupStep >= 3 ? 'bg-red-600' : 'bg-gray-300'}`}></div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs ${signupStep >= 3 ? 'bg-green-500' : 'bg-gray-300'}`}>
                                        {signupStep >= 3 ? '✓' : '3'}
                                    </div>
                                    <p className="text-[10px] text-gray-600 text-center">Finalizado</p>
                                </div>
                            </div>

                            <h2 className="text-lg font-bold text-gray-900 mb-3">Informações do Artista</h2>

                            <form onSubmit={handleSignupStep2} className="space-y-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome (Artista/Banda)</label>
                                    <input
                                        type="text"
                                        placeholder="Nome do artista ou banda"
                                        value={artistName}
                                        onChange={(e) => handleArtistNameChange(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">URL do Perfil</label>
                                    <div className="flex items-center gap-1">
                                        <span className="text-gray-600 text-xs whitespace-nowrap">oucaaqui.com/</span>
                                        <input
                                            type="text"
                                            placeholder="seuartista"
                                            value={artistSlug}
                                            onChange={(e) => {
                                                setArtistSlug(slugify(e.target.value));
                                                setArtistSlugError('');
                                            }}
                                            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none placeholder-gray-400 text-sm ${
                                                artistSlugError ? 'border-red-500 focus:border-red-600' : 'border-gray-300 focus:border-red-600'
                                            }`}
                                        />
                                    </div>
                                    {artistSlugError && <p className="text-red-500 text-xs mt-1">{artistSlugError}</p>}
                                    {artistSlug && !artistSlugError && (
                                        <p className="text-green-600 text-xs mt-1">oucaaqui.com/{artistSlug}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Cidade</label>
                                        <input
                                            type="text"
                                            placeholder="Sua cidade"
                                            value={artistCidade}
                                            onChange={(e) => setArtistCidade(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 placeholder-gray-400 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                                        <select
                                            value={artistEstado}
                                            onChange={(e) => setArtistEstado(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-sm"
                                        >
                                            <option value="">Selecione</option>
                                            {estadosBrasil.map((estado) => (
                                                <option key={estado.value} value={estado.value}>
                                                    {estado.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Gênero</label>
                                        <select
                                            value={artistGenero}
                                            onChange={(e) => setArtistGenero(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-sm"
                                        >
                                            <option value="">Selecione</option>
                                            <option value="masculino">Masculino</option>
                                            <option value="feminino">Feminino</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Estilo Musical</label>
                                        <select
                                            value={artistEstiloMusical}
                                            onChange={(e) => setArtistEstiloMusical(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-600 text-sm"
                                        >
                                            <option value="">Selecione</option>
                                            <option value="forro">Forró</option>
                                            <option value="arrocha">Arrocha</option>
                                            <option value="piseiro">Piseiro</option>
                                            <option value="arrochadeira">Arrochadeira</option>
                                            <option value="pagode">Pagode</option>
                                            <option value="sertanejo">Sertanejo</option>
                                            <option value="brega-funk">Brega Funk</option>
                                            <option value="variados">Variados</option>
                                            <option value="samba">Samba</option>
                                            <option value="funk">Funk</option>
                                            <option value="axe">Axé</option>
                                            <option value="reggae">Reggae</option>
                                            <option value="brega">Brega</option>
                                            <option value="gospel">Gospel</option>
                                            <option value="rap">Rap/Hip-Hop</option>
                                            <option value="pop">Pop</option>
                                            <option value="mpb">MPB</option>
                                            <option value="rock">Rock</option>
                                            <option value="eletronica">Eletrônica</option>
                                            <option value="podcast">Podcast</option>
                                            <option value="trap">Trap</option>
                                            <option value="frevo">Frevo</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        id="acceptTermsArtist"
                                        checked={acceptTermsArtist}
                                        onChange={(e) => {
                                            if (!termsReadByArtist) {
                                                openTermsModal('artist');
                                            } else {
                                                setAcceptTermsArtist(e.target.checked);
                                            }
                                        }}
                                        className="mt-1 cursor-pointer"
                                    />
                                    <label htmlFor="acceptTermsArtist" className="text-xs text-gray-700">
                                        Li e aceito os{' '}
                                        <span 
                                            className="text-red-600 underline cursor-pointer hover:text-red-700"
                                            onClick={() => openTermsModal('artist')}
                                        >
                                            termos de uso
                                        </span>
                                        {!termsReadByArtist && <span className="text-gray-500 text-xs ml-1">(Abra para ler)</span>}
                                    </label>
                                </div>

                                <div className="flex gap-3 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => setSignupStep(1)}
                                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-2 rounded-full transition-colors text-sm"
                                    >
                                        VOLTAR
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loadingSignup}
                                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 rounded-full transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        {loadingSignup && <Loader2 className="w-4 h-4 animate-spin" />}
                                        CADASTRAR
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : signupStep === 3 ? (
                        // SIGNUP STEP 3 - Success - Compacto
                        <div className="bg-white p-5 min-h-auto max-w-lg mx-auto">
                            {/* Stepper Visual - Compacto */}
                            <div className="flex items-center justify-between mb-4 pt-4">
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs">✓</div>
                                    <p className="text-[10px] text-gray-600 text-center">Básicas</p>
                                </div>
                                <div className="flex-1 h-0.5 bg-green-500 mx-2"></div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs">✓</div>
                                    <p className="text-[10px] text-gray-600 text-center">Artista</p>
                                </div>
                                <div className="flex-1 h-0.5 bg-green-500 mx-2"></div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs">✓</div>
                                    <p className="text-[10px] text-gray-600 text-center">Finalizado</p>
                                </div>
                            </div>

                            {/* Conteúdo de Sucesso */}
                            <div className="flex flex-col items-center justify-center py-6">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                    </svg>
                                </div>

                                <h2 className="text-lg font-bold text-gray-900 text-center mb-2">Cadastro finalizado!</h2>
                                <p className="text-gray-600 text-center text-sm mb-4">
                                    Verifique seu e-mail para confirmar sua conta.
                                </p>

                                <button
                                    onClick={() => {
                                        setSignupName('');
                                        setSignupEmail('');
                                        setSignupPassword('');
                                        setSignupConfirmPassword('');
                                        setArtistName('');
                                        setArtistSlug('');
                                        setArtistSlugError('');
                                        setArtistCidade('');
                                        setArtistEstado('');
                                        setArtistGenero('');
                                        setArtistEstiloMusical('');
                                        setAcceptTerms(false);
                                        setAcceptTermsArtist(false);
                                        setUserType('user');
                                        setSignupStep(1);
                                        onClose();
                                    }}
                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2 rounded-lg transition-colors text-sm"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
                </div>
            </div>



            {/* Modal de Termos de Uso */}
            {showTermsModal && (
                <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
                    <DialogContent style={{ maxWidth: 600, padding: 0 }}>
                        <DialogTitle style={{ padding: '24px 24px 0 24px', fontWeight: 700, fontSize: 20 }}>Termos de Uso</DialogTitle>
                        <DialogDescription>
                            <div style={{ maxHeight: '50vh', overflowY: 'auto', textAlign: 'left', padding: 24 }}>
                                {termosDeUso}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                                <button
                                    type="button"
                                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 48px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
                                    onClick={acceptTermsModal}
                                >
                                    Concordo
                                </button>
                            </div>
                        </DialogDescription>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

export default AuthModal;
