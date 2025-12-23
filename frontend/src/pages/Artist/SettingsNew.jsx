import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { artistApi } from '../../lib/artistApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Camera, Save, Link, Settings } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import ArtistSidebar from '../../components/Artist/ArtistSidebar';
import LoadingSpinner from '../../components/LoadingSpinner';

const genreLabels = {
  'forro': 'Forró',
  'arrocha': 'Arrocha',
  'piseiro': 'Piseiro',
  'arrochadeira': 'Arrochadeira',
  'pagode': 'Pagode',
  'sertanejo': 'Sertanejo',
  'brega-funk': 'Brega Funk',
  'variados': 'Variados',
  'samba': 'Samba',
  'funk': 'Funk',
  'axe': 'Axé',
  'reggae': 'Reggae',
  'brega': 'Brega',
  'gospel': 'Gospel',
  'rap': 'Rap/Hip-Hop',
  'pop': 'Pop',
  'mpb': 'MPB',
  'rock': 'Rock',
  'eletronica': 'Eletrônica',
  'podcast': 'Podcast',
  'trap': 'Trap',
  'frevo': 'Frevo'
};

const SettingsNew = () => {
  const { user, updateUser } = useAuth();
  const [artist, setArtist] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [pendingCoverFile, setPendingCoverFile] = useState(null);
  
  useEffect(() => {
    const loadArtistData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      // Carregar do Supabase
      try {
        const { data: artistData, error } = await artistApi.getArtist(user.id);

        if (artistData && !error) {
          setArtist({
            id: artistData.id,
            name: artistData.name || user.name,
            slug: artistData.slug || '',
            bio: artistData.bio || '',
            genre: artistData.estilo_musical || '',
            cidade: artistData.cidade || '',
            estado: artistData.estado || '',
            location: artistData.cidade && artistData.estado 
              ? `${artistData.cidade}, ${artistData.estado}` 
              : artistData.cidade || artistData.estado || '',
            avatar: artistData.avatar_url || '/images/default-avatar.png',
            coverImage: artistData.cover_url || '',
            followers: artistData.followers_count || 0,
            monthlyListeners: 0,
            instagram: artistData.instagram || '',
            twitter: artistData.twitter || '',
            youtube: artistData.youtube || ''
          });
        } else {
          setArtist({
            id: user.id,
            name: user.name || '',
            slug: '',
            bio: '',
            genre: user.estilo_musical || '',
            cidade: user.cidade || '',
            estado: user.estado || '',
            location: user.cidade && user.estado 
              ? `${user.cidade}, ${user.estado}` 
              : user.cidade || user.estado || '',
            avatar: user.avatar || '/images/default-avatar.png',
            coverImage: '',
            followers: 0,
            monthlyListeners: 0,
            instagram: '',
            twitter: '',
            youtube: ''
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados do artista:', error);
        setArtist({
          id: user.id,
          name: user.name || '',
          slug: '',
          bio: '',
          genre: user.estilo_musical || '',
          cidade: user.cidade || '',
          estado: user.estado || '',
          location: '',
          avatar: user.avatar || '/images/default-avatar.png',
          coverImage: '',
          followers: 0,
          monthlyListeners: 0,
          instagram: '',
          twitter: '',
          youtube: ''
        });
      }
      setLoading(false);
    };

    loadArtistData();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setArtist(prev => ({ ...prev, [name]: value }));
  };

  const uploadImage = async (file, type) => {
    if (!file || !user?.id) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}_${type}_${Date.now()}.${fileExt}`;
    const filePath = `${type}s/${fileName}`;
    
    console.log('Fazendo upload:', filePath);
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      throw uploadError;
    }
    
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    
    console.log('URL pública:', urlData.publicUrl);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!user || !artist) return;

    setSaving(true);
    
    try {
      let avatarUrl = artist.avatar || '';
      let coverUrl = artist.coverImage || '';
      
      // Fazer upload das imagens pendentes
      if (pendingAvatarFile) {
        try {
          const uploadedUrl = await uploadImage(pendingAvatarFile, 'avatar');
          if (uploadedUrl) avatarUrl = uploadedUrl;
        } catch (err) {
          console.error('Erro upload avatar:', err);
          toast({ title: 'Aviso', description: 'Não foi possível enviar a foto de perfil.' });
        }
      }
      
      if (pendingCoverFile) {
        try {
          const uploadedUrl = await uploadImage(pendingCoverFile, 'cover');
          if (uploadedUrl) coverUrl = uploadedUrl;
        } catch (err) {
          console.error('Erro upload capa:', err);
          toast({ title: 'Aviso', description: 'Não foi possível enviar a capa.' });
        }
      }
      
      // Limpar URLs base64 apenas se não houver upload
      if (avatarUrl?.startsWith('data:')) avatarUrl = '';
      if (coverUrl?.startsWith('data:')) coverUrl = '';

      const artistData = {
        name: artist.name || '',
        slug: artist.slug || '',
        bio: artist.bio || '',
        estilo_musical: artist.genre || '',
        cidade: artist.cidade || '',
        estado: artist.estado || '',
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        instagram: artist.instagram || '',
        twitter: artist.twitter || '',
        youtube: artist.youtube || ''
      };

      // Salvar no Supabase
      const { data: savedData, error: saveError } = await artistApi.saveArtist(user.id, user.email, artistData);

      if (saveError) {
        console.error('Erro ao salvar:', saveError);
        toast({
          title: 'Erro',
          description: 'Não foi possível salvar as alterações. Verifique sua conexão.',
          variant: 'destructive'
        });
        setSaving(false);
        return;
      }

      console.log('Salvo com sucesso:', savedData);

      setArtist(prev => ({
        ...prev,
        avatar: avatarUrl || prev.avatar,
        coverImage: coverUrl || prev.coverImage
      }));
      
      setPendingAvatarFile(null);
      setPendingCoverFile(null);

      const updatedUser = { ...user, name: artist.name, avatar: avatarUrl || artist.avatar };
      if (typeof updateUser === 'function') updateUser(updatedUser);

      toast({
        title: 'Perfil atualizado!',
        description: 'Suas informações foram salvas com sucesso'
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Erro inesperado:', err);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };
  
  if (loading || !artist) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <LoadingSpinner size="large" text="Carregando..." />
      </div>
    );
  }

  const handleImageUpload = (e, type) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    if (type === 'avatar') {
      setPendingAvatarFile(file);
    } else {
      setPendingCoverFile(file);
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (type === 'avatar') {
        setArtist(prev => ({ ...prev, avatar: dataUrl }));
      } else {
        setArtist(prev => ({ ...prev, coverImage: dataUrl }));
      }

      toast({
        title: 'Imagem selecionada',
        description: 'Clique em "Salvar Alterações" para confirmar'
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-red-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Configurações do Perfil</h1>
          </div>
          <Button
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            disabled={saving}
          >
            {saving ? (
              'Salvando...'
            ) : isEditing ? (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            ) : (
              'Editar Perfil'
            )}
          </Button>
        </div>

        <Card className="bg-white shadow-sm mb-6 overflow-hidden">
          <div className="relative h-40 sm:h-64 bg-gradient-to-r from-red-600 to-red-800">
            {artist.coverImage && (
              <img
                src={artist.coverImage}
                alt="Capa"
                className="w-full h-full object-cover"
              />
              )}
              {isEditing && (
                <label
                  htmlFor="coverUpload"
                  className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors"
                >
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-white mx-auto mb-2" />
                    <p className="text-white font-medium">Alterar Capa</p>
                  </div>
                  <input
                    id="coverUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'cover')}
                  />
                </label>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white shadow-sm md:col-span-1">
              <div className="p-4 md:p-6">
                <div className="relative w-32 h-32 sm:w-48 sm:h-48 mx-auto mb-4">
                  <img
                    src={artist.avatar}
                    alt={artist.name}
                    className="w-full h-full rounded-full object-cover bg-gray-200"
                  />
                  {isEditing && (
                    <label
                      htmlFor="avatarUpload"
                      className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors"
                    >
                      <Camera className="w-8 h-8 text-white" />
                      <input
                        id="avatarUpload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, 'avatar')}
                      />
                    </label>
                  )}
                </div>
                <div className="text-center space-y-4">
                  <div>
                    <p className="text-gray-600 text-sm">Seguidores</p>
                    <p className="text-2xl font-bold text-gray-900">{artist.followers?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Ouvintes Mensais</p>
                    <p className="text-2xl font-bold text-gray-900">{artist.monthlyListeners?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-white shadow-sm md:col-span-2">
              <div className="p-4 md:p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Informações do Perfil</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-700">Nome Artístico</Label>
                    <Input
                      id="name"
                      name="name"
                      value={artist.name || ''}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="disabled:opacity-70"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-gray-700 flex items-center gap-2">
                      <Link className="w-4 h-4" />
                      URL do Perfil
                    </Label>
                    <div className="flex items-center">
                      <span className="text-gray-500 text-sm mr-2">oucaaqui.com/</span>
                      <Input
                        id="slug"
                        name="slug"
                        value={artist.slug || ''}
                        onChange={(e) => {
                          const value = e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, '')
                            .replace(/[^a-z0-9]/g, '');
                          setArtist(prev => ({ ...prev, slug: value }));
                        }}
                        disabled={!isEditing}
                        placeholder="seunome"
                        className="disabled:opacity-70 flex-1"
                      />
                    </div>
                    {isEditing && (
                      <p className="text-xs text-gray-500">
                        Apenas letras minúsculas e números, sem espaços ou caracteres especiais.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio" className="text-gray-700">Biografia</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={artist.bio || ''}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      rows={4}
                      className="disabled:opacity-70 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="genre" className="text-gray-700">Estilo Musical</Label>
                      {isEditing ? (
                        <Select
                          value={artist.genre || ''}
                          onValueChange={(value) => setArtist(prev => ({ ...prev, genre: value }))}
                          disabled={!isEditing}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o estilo" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(genreLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={genreLabels[artist.genre] || artist.genre || ''}
                          disabled
                          className="disabled:opacity-70"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-gray-700">Localização</Label>
                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            id="cidade"
                            name="cidade"
                            placeholder="Cidade"
                            value={artist.cidade || ''}
                            onChange={handleInputChange}
                          />
                          <Input
                            id="estado"
                            name="estado"
                            placeholder="Estado"
                            value={artist.estado || ''}
                            onChange={handleInputChange}
                          />
                        </div>
                      ) : (
                        <Input
                          value={artist.location || ''}
                          disabled
                          className="disabled:opacity-70"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-700">Redes Sociais</Label>
                    <div className="space-y-3">
                      <Input
                        name="instagram"
                        placeholder="Instagram"
                        value={artist.instagram || ''}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="disabled:opacity-70"
                      />
                      <Input
                        name="twitter"
                        placeholder="Twitter/X"
                        value={artist.twitter || ''}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="disabled:opacity-70"
                      />
                      <Input
                        name="youtube"
                        placeholder="YouTube"
                        value={artist.youtube || ''}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="disabled:opacity-70"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
  );
};

export default SettingsNew;
