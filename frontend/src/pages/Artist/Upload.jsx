import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Upload as UploadIcon, Music, AlertCircle, CheckCircle } from 'lucide-react';

import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../hooks/use-toast';

const Upload = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    album: '',
    genre: '',
    releaseYear: new Date().getFullYear(),
    description: '',
    audioFile: null,
    coverImage: null
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e, fileType) => {
    const file = e.target.files[0];
    if (fileType === 'audioFile' && file) {
      setIsUploading(true);
      setUploadProgress(0);

      try {
        const filePath = `albuns/${Date.now()}_${file.name}`;
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            setFormData(prev => ({ ...prev, [fileType]: file, audioFilePath: filePath }));
            setUploadProgress(0);
            setIsUploading(false);
            
            toast({
              title: 'Arquivo enviado',
              description: `${file.name} foi enviado com sucesso!`
            });
          } else {
            throw new Error('Erro ao fazer upload');
          }
          });

          xhr.addEventListener('error', () => {
          setIsUploading(false);
          setUploadProgress(0);
          toast({
            title: 'Erro no upload',
            description: 'Falha ao enviar o arquivo',
            variant: 'destructive'
          });
        });

        const { data: { session } } = await supabase.auth.getSession();
        xhr.open('POST', `${process.env.REACT_APP_SUPABASE_URL}/storage/v1/object/musica/${filePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`);
        
        const formDataXhr = new FormData();
        formDataXhr.append('file', file);
        xhr.send(formDataXhr);
      } catch (error) {
        setIsUploading(false);
        setUploadProgress(0);
        toast({
          title: 'Erro no upload',
          description: error.message,
          variant: 'destructive'
        });
      }
    } else if (file) {
      setFormData(prev => ({ ...prev, [fileType]: file }));
      toast({
        title: 'Arquivo selecionado',
        description: `${file.name} foi carregado com sucesso`
      });
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.audioFile) {
      toast({
        title: 'Arquivo necessário',
        description: 'Por favor, faça upload do arquivo de áudio',
        variant: 'destructive'
      });
      return;
    }
    if (currentStep === 2 && (!formData.title || !formData.artist)) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha título e artista',
        variant: 'destructive'
      });
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handlePublish();
    }
  };

  const handlePublish = () => {
    toast({
      title: 'Música publicada!',
      description: 'Sua música foi publicada com sucesso e já está disponível na plataforma'
    });
    setFormData({
      title: '',
      artist: '',
      album: '',
      genre: '',
      releaseYear: new Date().getFullYear(),
      description: '',
      audioFile: null,
      coverImage: null
    });
    setCurrentStep(1);
  };

  return (
    <div className="bg-gray-50 w-full hide-scrollbar">
      <div className="bg-gradient-to-b from-red-950/20 to-black p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">Novo Upload</h1>
          <p className="text-gray-400 mb-8">Compartilhe sua música com o mundo</p>
          <div className="flex items-center justify-center mb-12">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                      step === currentStep
                        ? 'bg-red-600 text-white scale-110'
                        : step < currentStep
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-800 text-gray-400'
                    }`}
                  >
                    {step < currentStep ? <CheckCircle className="w-6 h-6" /> : step}
                  </div>
                  <p
                    className={`text-sm mt-2 ${
                      step === currentStep ? 'text-red-600 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    {step === 1 && 'Envio do arquivo'}
                    {step === 2 && 'Informações'}
                    {step === 3 && 'Publicado!'}
                  </p>
                </div>
                {step < 3 && (
                  <div
                    className={`w-24 h-1 mx-2 ${
                      step < currentStep ? 'bg-green-600' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {currentStep === 1 && (
            <Card className="bg-zinc-900 border-red-900/20">
              <CardHeader>
                <CardTitle className="text-white">1. Envio do Álbum Completo</CardTitle>
                <CardDescription className="text-gray-400">
                  Faça upload do arquivo RAR contendo todas as músicas do álbum em MP3
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-2 border-dashed border-red-900/30 rounded-lg p-12 text-center hover:border-red-600 transition-colors cursor-pointer">
                  <input
                    type="file"
                    id="audioFile"
                    accept=".zip,.rar"
                    onChange={(e) => handleFileChange(e, 'audioFile')}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <label htmlFor="audioFile" className={`cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UploadIcon className="w-10 h-10 text-red-600" />
                    </div>
                    <p className="text-white font-medium mb-2">
                      {isUploading ? `Enviando... ${uploadProgress}%` : formData.audioFile ? formData.audioFile.name : 'Clique aqui ou arraste seu arquivo RAR'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Arquivos permitidos: ZIP ou RAR (até 250 MB)<br />
                      O arquivo deve conter todas as músicas do álbum em formato MP3
                    </p>
                  </label>
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white font-medium">Progresso do Upload</span>
                      <span className="text-sm text-red-600 font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-red-600 to-red-500 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-400">
                    <p className="font-semibold mb-1">Para lembrar:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Realize apenas uploads de sua propriedade ou sobre os quais você detém legalmente os direitos.</li>
                      <li>O arquivo RAR será extraído e as músicas serão disponibilizadas individualmente.</li>
                      <li>O álbum completo também ficará disponível para download.</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="bg-zinc-900 border-red-900/20">
              <CardHeader>
                <CardTitle className="text-white">2. Informações do Álbum</CardTitle>
                <CardDescription className="text-gray-400">
                  Preencha os detalhes do seu álbum
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-white">Título *</Label>
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="Nome da música"
                      className="bg-zinc-800 border-red-900/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="artist" className="text-white">Artista *</Label>
                    <Input
                      id="artist"
                      name="artist"
                      value={formData.artist}
                      onChange={handleInputChange}
                      placeholder="Nome do artista"
                      className="bg-zinc-800 border-red-900/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="album" className="text-white">Álbum</Label>
                    <Input
                      id="album"
                      name="album"
                      value={formData.album}
                      onChange={handleInputChange}
                      placeholder="Nome do álbum"
                      className="bg-zinc-800 border-red-900/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="genre" className="text-white">Gênero</Label>
                    <Input
                      id="genre"
                      name="genre"
                      value={formData.genre}
                      onChange={handleInputChange}
                      placeholder="Pop, Rock, Hip-Hop..."
                      className="bg-zinc-800 border-red-900/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="releaseYear" className="text-white">Ano de Lançamento</Label>
                    <Input
                      id="releaseYear"
                      name="releaseYear"
                      type="number"
                      value={formData.releaseYear}
                      onChange={handleInputChange}
                      className="bg-zinc-800 border-red-900/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coverImage" className="text-white">Capa do Álbum</Label>
                    <Input
                      id="coverImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'coverImage')}
                      className="bg-zinc-800 border-red-900/30 text-white file:bg-red-600 file:text-white file:border-0 file:rounded file:px-4 file:py-2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-white">Descrição</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Conte mais sobre sua música..."
                    rows={4}
                    className="bg-zinc-800 border-red-900/30 text-white resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="bg-zinc-900 border-red-900/20 text-center">
              <CardContent className="py-12">
                <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Música Publicada!</h2>
                <p className="text-gray-400 mb-8">
                  Sua música foi publicada com sucesso e já está disponível na plataforma
                </p>
                <div className="bg-zinc-800 rounded-lg p-6 max-w-md mx-auto">
                  <Music className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <p className="text-white font-semibold mb-2">{formData.title || 'Sua música'}</p>
                  <p className="text-gray-400 text-sm">{formData.artist || 'Artista'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
              disabled={currentStep === 1 || currentStep === 3}
              className="border-red-900/30 text-white hover:bg-red-900/20"
            >
              Voltar
            </Button>
            <Button
              onClick={handleNext}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {currentStep === 3 ? 'Fazer Novo Upload' : currentStep === 2 ? 'Publicar' : 'Próximo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;