import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from '../../hooks/use-toast';
import { Send, MessageSquare, Plus, Clock, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const Support = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replies, setReplies] = useState([]);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [showNewMessage, setShowNewMessage] = useState(false);
    const [newMessageData, setNewMessageData] = useState({
        subject: '',
        message: ''
    });
    const [sendingMessage, setSendingMessage] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        loadMessages();
        loadUserProfile();
        const subscription = supabase
            .channel('support_messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
                loadMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user?.id]);

    const loadUserProfile = async () => {
        if (!user?.id) return;

        try {
            // Tentar encontrar avatar no storage: avatars/{user_id}_avatar_*.jpg
            const { data: files } = await supabase.storage
                .from('avatars')
                .list(`avatars`, {
                    limit: 1,
                    search: `${user.id}_avatar`
                });

            if (files && files.length > 0) {
                const avatarFile = files[0];
                const avatarUrl = supabase.storage
                    .from('avatars')
                    .getPublicUrl(`avatars/${avatarFile.name}`).data.publicUrl;

                setUserProfile({ avatar_url: avatarUrl });
            } else {
                setUserProfile({ id: user.id });
            }
        } catch (err) {
            console.log('Error loading user avatar:', err);
            setUserProfile({ id: user.id });
        }
    };

    useEffect(() => {
        if (selectedMessage?.id) {
            loadReplies(selectedMessage.id);
        }
    }, [selectedMessage?.id]);

    const loadMessages = async () => {
        if (!user?.id) return;

        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .eq('sender_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            setMessages(data);
        }
        setLoading(false);
    };

    const loadReplies = async (messageId) => {
        const { data, error } = await supabase
            .from('support_replies')
            .select('*')
            .eq('message_id', messageId)
            .order('created_at', { ascending: true });

        if (data) {
            const repliesWithAvatars = data.map((reply) => ({
                ...reply,
                senderAvatar: reply.sender_avatar_url
            }));
            setReplies(repliesWithAvatars);
        }
    };

    const handleCreateMessage = async (e) => {
        e.preventDefault();

        if (!newMessageData.subject.trim() || !newMessageData.message.trim()) {
            toast({
                title: 'Erro',
                description: 'Preenchera o assunto e a mensagem',
                variant: 'destructive'
            });
            return;
        }

        setSendingMessage(true);

        const { data, error } = await supabase
            .from('support_messages')
            .insert({
                sender_id: user.id,
                sender_email: user.email,
                sender_type: 'artist',
                subject: newMessageData.subject,
                message: newMessageData.message,
                status: 'open',
                sender_avatar_url: userProfile?.avatar_url || null
            })
            .select()
            .single();

        if (error) {
            toast({
                title: 'Erro ao enviar',
                description: error.message,
                variant: 'destructive'
            });
        } else {
            setMessages([data, ...messages]);
            setNewMessageData({ subject: '', message: '' });
            setShowNewMessage(false);
            toast({
                title: 'Mensagem enviada',
                description: 'O administrador responderá em até 24 horas'
            });
        }

        setSendingMessage(false);
    };

    const handleSendReply = async () => {
        if (!replyText.trim()) {
            toast({
                title: 'Erro',
                description: 'Digite uma resposta',
                variant: 'destructive'
            });
            return;
        }

        if (!selectedMessage?.id) return;

        setSendingReply(true);

        const { error } = await supabase
            .from('support_replies')
            .insert({
                message_id: selectedMessage.id,
                sender_id: user.id,
                sender_type: 'artist',
                reply_text: replyText,
                sender_avatar_url: userProfile?.avatar_url || null
            });

        if (error) {
            toast({
                title: 'Erro ao enviar',
                description: error.message,
                variant: 'destructive'
            });
        } else {
            setReplyText('');
            await loadReplies(selectedMessage.id);
            toast({
                title: 'Resposta enviada',
                description: 'Seu recado foi enviado'
            });
        }

        setSendingReply(false);
    };

    if (loading) {
        return (
            <div className="w-full h-screen flex items-center justify-center">
                <LoadingSpinner size="large" text="Carregando suporte..." />
            </div>
        );
    }

    return (
        <div className="w-full bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Suporte</h1>
                            <p className="text-gray-600 text-sm mt-1">
                                Comunique-se diretamente com nosso time
                            </p>
                        </div>
                        <Button
                            onClick={() => setShowNewMessage(!showNewMessage)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Conversa
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden px-8 py-6">
                    <div className="max-w-6xl mx-auto h-full">
                        {showNewMessage ? (
                            // New Message Form
                            <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
                                <h2 className="text-lg font-bold text-gray-900 mb-6">Iniciar Nova Conversa</h2>
                                <form onSubmit={handleCreateMessage} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Assunto
                                        </label>
                                        <Input
                                            value={newMessageData.subject}
                                            onChange={(e) =>
                                                setNewMessageData({ ...newMessageData, subject: e.target.value })
                                            }
                                            placeholder="Ex: Problema com upload de música"
                                            className="w-full"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Descrição
                                        </label>
                                        <textarea
                                            value={newMessageData.message}
                                            onChange={(e) =>
                                                setNewMessageData({ ...newMessageData, message: e.target.value })
                                            }
                                            placeholder="Descreva seu problema ou dúvida com detalhes..."
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-40 focus:outline-none focus:ring-2 focus:ring-red-600"
                                        />
                                    </div>

                                    {/* Info Box */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                                        <div className="flex items-start gap-3">
                                            <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-medium text-amber-900">
                                                    Tempo de resposta: até 24 horas
                                                </p>
                                                <p className="text-xs text-amber-700 mt-1">
                                                    Nossa equipe responde todas as mensagens dentro de 24 horas úteis. Você receberá uma notificação quando houver uma resposta.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        <Button
                                            type="submit"
                                            disabled={sendingMessage}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            {sendingMessage ? 'Enviando...' : 'Enviar Mensagem'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowNewMessage(false)}
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            // Chat View
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                                {/* Conversations List */}
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-gray-200">
                                        <h2 className="font-semibold text-gray-900">Conversas</h2>
                                        <p className="text-xs text-gray-500 mt-1">{messages.length} conversa(s)</p>
                                    </div>

                                    {messages.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
                                            <div className="text-center">
                                                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                                <p className="text-sm">Nenhuma conversa ainda</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-y-auto flex-1">
                                            {messages.map((message) => (
                                                <button
                                                    key={message.id}
                                                    onClick={() => setSelectedMessage(message)}
                                                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition ${selectedMessage?.id === message.id
                                                        ? 'bg-blue-50 border-l-4 border-l-blue-600'
                                                        : ''
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h3 className="font-medium text-gray-900 text-sm truncate flex-1">
                                                            {message.subject}
                                                        </h3>
                                                        {message.status === 'resolved' && (
                                                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                                        {message.message}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${message.status === 'open'
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : message.status === 'in_progress'
                                                                    ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-green-100 text-green-700'
                                                                }`}
                                                        >
                                                            {message.status === 'open' && 'Aberto'}
                                                            {message.status === 'in_progress' && 'Em andamento'}
                                                            {message.status === 'resolved' && 'Resolvido'}
                                                        </span>
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(message.created_at).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Chat Area */}
                                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                                    {selectedMessage ? (
                                        <>
                                            {/* Chat Header */}
                                            <div className="border-b border-gray-200 p-4 bg-gray-50">
                                                <h3 className="font-semibold text-gray-900">
                                                    {selectedMessage.subject}
                                                </h3>
                                                <div className="flex items-center justify-between mt-2">
                                                    <p className="text-xs text-gray-500">
                                                        Iniciada {new Date(selectedMessage.created_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <span
                                                        className={`text-xs px-2 py-1 rounded ${selectedMessage.status === 'open'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : selectedMessage.status === 'in_progress'
                                                                ? 'bg-yellow-100 text-yellow-700'
                                                                : 'bg-green-100 text-green-700'
                                                            }`}
                                                    >
                                                        {selectedMessage.status === 'open' && 'Aberto'}
                                                        {selectedMessage.status === 'in_progress' && 'Em andamento'}
                                                        {selectedMessage.status === 'resolved' && 'Resolvido'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Messages */}
                                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                                                {/* Welcome Message */}
                                                <div className="flex justify-center">
                                                    <div className="bg-white px-4 py-2 rounded-full text-xs text-gray-500 border border-gray-200">
                                                        Conversa iniciada
                                                    </div>
                                                </div>

                                                {/* Original Message */}
                                                <div className="flex justify-end gap-3">
                                                    <div className="bg-red-600 text-white rounded-lg rounded-tr-none p-4 max-w-md">
                                                        <p className="text-base whitespace-pre-wrap leading-relaxed">
                                                            {selectedMessage.message}
                                                        </p>
                                                        <p className="text-xs mt-3 opacity-70">
                                                            {new Date(selectedMessage.created_at).toLocaleTimeString('pt-BR', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {userProfile?.avatar_url ? (
                                                            <img
                                                                src={userProfile.avatar_url}
                                                                alt="Avatar"
                                                                className="w-10 h-10 rounded-full object-cover border-2 border-red-600"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-semibold text-sm">
                                                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Auto Response */}
                                                {replies.length === 0 && selectedMessage.status === 'open' && (
                                                    <div className="flex justify-start gap-3">
                                                        <div className="flex-shrink-0">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                                                S
                                                            </div>
                                                        </div>
                                                        <div className="bg-white rounded-lg rounded-tl-none p-4 max-w-md border border-gray-200">
                                                            <div className="flex items-start gap-2">
                                                                <div className="flex-shrink-0 mt-1">
                                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-base font-medium text-gray-900">
                                                                        Mensagem recebida
                                                                    </p>
                                                                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                                                        Obrigado por entrar em contato. Nossa equipe analisará sua solicitação e entrará em contato em até 24 horas úteis com uma resposta detalhada.
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 mt-3">Agora</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Replies */}
                                                {replies.map((reply) => (
                                                    <div
                                                        key={reply.id}
                                                        className={`flex ${reply.sender_type === 'admin' ? 'justify-start' : 'justify-end'} gap-3`}
                                                    >
                                                        {reply.sender_type === 'admin' && (
                                                            <div className="flex-shrink-0">
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                                                    S
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`rounded-lg p-4 max-w-md ${reply.sender_type === 'admin'
                                                                ? 'bg-white border border-gray-200 rounded-tl-none'
                                                                : 'bg-red-600 text-white rounded-tr-none'
                                                                }`}
                                                        >
                                                            <p className={`text-base whitespace-pre-wrap leading-relaxed ${reply.sender_type === 'admin' ? 'text-gray-700' : 'text-white'}`}>
                                                                {reply.reply_text}
                                                            </p>
                                                            <p className={`text-xs mt-3 ${reply.sender_type === 'admin' ? 'text-gray-500' : 'opacity-70'}`}>
                                                                {new Date(reply.created_at).toLocaleTimeString('pt-BR', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </p>
                                                        </div>
                                                        {reply.sender_type !== 'admin' && (
                                                            <div className="flex-shrink-0">
                                                                {reply.senderAvatar ? (
                                                                    <img
                                                                        src={reply.senderAvatar}
                                                                        alt="Avatar"
                                                                        className="w-10 h-10 rounded-full object-cover border-2 border-red-600"
                                                                    />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-semibold text-sm">
                                                                        {user?.email?.charAt(0).toUpperCase() || 'D'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Reply Input */}
                                            {selectedMessage.status !== 'resolved' && (
                                                <div className="border-t border-gray-200 p-4 bg-white">
                                                    <div className="flex gap-2">
                                                        <textarea
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder="Digite sua mensagem..."
                                                            className="flex-1 border border-gray-300 rounded-lg p-3 text-sm min-h-12 max-h-32 focus:outline-none focus:ring-2 focus:ring-red-600 resize-none"
                                                        />
                                                        <Button
                                                            onClick={handleSendReply}
                                                            disabled={sendingReply || !replyText.trim()}
                                                            className="bg-red-600 hover:bg-red-700 h-12"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-gray-500">
                                            <div className="text-center">
                                                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                                <p className="text-gray-600">Selecione uma conversa para continuar</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                    </div>
                    );
                    };

export default Support;
