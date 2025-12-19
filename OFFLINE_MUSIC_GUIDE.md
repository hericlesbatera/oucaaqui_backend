# Guia: Reprodução de Músicas Offline (PWA + IndexedDB/Capacitor)

## Visão Geral

Sistema completo para download e reprodução offline de álbuns no app mobile e PWA.

### Fluxo
1. **Desktop**: Baixa ZIP/RAR do álbum
2. **Mobile/App**: Baixa MP3s individuais via Capacitor → Filesystem → Preferences
3. **Biblioteca**: Mostra álbuns baixados com opção de expandir e ver músicas
4. **Reprodução**: Carrega URLs locais e toca via PlayerContext

## Arquitetura

### 1. Storage de Downloads

**Mobile (Capacitor)**:
- Pasta: `/Documents/downloads/{Album Title Sanitized}`
- Arquivos: `01 - Song Title.mp3`, `02 - Song Title.mp3`, etc.
- Metadata: Armazenada em `@capacitor/preferences` (key: `downloads_metadata`)

**Web (PWA)**:
- Não está implementado (veja section "TODO: PWA" ao final)

### 2. Hooks Principais

#### `useCapacitorDownloads()`
```javascript
import { useCapacitorDownloads } from '../hooks/useCapacitorDownloads';

const {
  downloads,              // Array de álbuns baixados
  downloadProgress,       // Progresso: { [albumId]: { current, total } }
  downloadAlbum,         // async (album, songs) => downloadedAlbum
  deleteDownloadedAlbum, // async (albumId) => void
  isCapacitorAvailable   // boolean
} = useCapacitorDownloads();
```

#### `useOfflinePlayer()`
```javascript
import { useOfflinePlayer } from '../hooks/useOfflinePlayer';

const {
  getOfflineSongURL,    // async (albumDir, fileName) => URL
  loadAlbumOfflineURLs, // async (albumDir, songs) => songs with audioUrl
  clearURLCache        // () => void
} = useOfflinePlayer();
```

### 3. Fluxo de Download

**AlbumPage.jsx** → `handleDownloadAlbum()`
```
1. Detecta plataforma (Desktop vs Mobile)
2. Se Mobile:
   - Chama `downloadAlbum(album, songs)`
   - Mostra progresso: "BAIXANDO 3/8..."
   - Salva metadata em Preferences
3. Se Desktop:
   - Download ZIP/RAR normal
```

### 4. Reprodução Offline

**Library.jsx** → `handlePlayDownloadedAlbum()`
```
1. Usuário clica no álbum baixado
2. Chama `loadAlbumOfflineURLs(albumDir, songs)`
3. Para cada música:
   - Lê arquivo do Filesystem em base64
   - Cria Blob URL
   - Cacheia em `useOfflinePlayer`
4. Cria queue com audioUrls locais
5. Passa para `playSong(song, queue)`
```

## Implementação Completa Checklist

### ✅ Feito
- [x] `useCapacitorDownloads.js` - Download e storage
- [x] `useOfflinePlayer.js` - Carregamento de URLs locais
- [x] `Library.jsx` - UI com expansão de músicas
- [x] `AlbumPage.jsx` - Progresso visual do download

### 🔧 Testar

1. **Android APK**:
```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
```

2. **Testar flow**:
   - [ ] Login no app
   - [ ] Ir para álbum
   - [ ] Clicar "BAIXAR CD COMPLETO"
   - [ ] Ver progresso "BAIXANDO 1/8..."
   - [ ] Ir para Biblioteca > Downloads
   - [ ] Clicar no álbum → começa reprodução offline
   - [ ] Expandir para ver músicas
   - [ ] Clicar em música específica

### ❌ Issues Conhecidas

1. **Base64 em Blob é lento**
   - Para arquivos grandes (>100MB álbum), há delay ao carregar
   - Solução futura: usar Blob direto em vez de Base64

2. **PWA (Web)**
   - Hook `useDownloads.js` existe mas não está integrado
   - Precisa usar IndexedDB para PWA web
   - TODO: Integrar IndexedDB na Library.jsx também

3. **URLs temporárias**
   - Blob URLs expiram quando página recarrega
   - Solução: persistir em Service Worker (future)

## TODO: Melhorias Futuras

### 1. PWA Storage (IndexedDB + Cache API)
```javascript
// Em useOfflinePlayer.js, adicionar:
const getOfflineSongURLWeb = async (albumId, songId) => {
  const db = await openDB('OucaaquiDownloads');
  const record = await db.get('downloads', songId);
  return URL.createObjectURL(record.fileBlob);
};
```

### 2. Background Download
```javascript
// Service Worker
self.addEventListener('sync', event => {
  if (event.tag === 'download-album') {
    event.waitUntil(downloadAlbumsInBackground());
  }
});
```

### 3. Storage Quota Check
```javascript
const storageInfo = await navigator.storage.estimate();
const percentUsed = (storageInfo.usage / storageInfo.quota) * 100;
```

### 4. Melhorar Performance de Base64
```javascript
// Em vez de Blob URL, usar stream direto
const response = await Filesystem.readFile({ path, directory });
const reader = new FileReader();
reader.readAsArrayBuffer(response.data);
```

## Testing Commands

```bash
# Build mobile
npm run build && npx cap sync

# Test web PWA
npm start

# Check downloads in DevTools
# Storage > Preferences > downloads_metadata
# Or: localStorage.getItem('downloads_metadata')
```

## Referências

- [Capacitor Filesystem Docs](https://capacitorjs.com/docs/apis/filesystem)
- [Capacitor Preferences Docs](https://capacitorjs.com/docs/apis/preferences)
- [IndexedDB MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Worker Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
