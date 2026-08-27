// 1. Configuração do Cliente Supabase
// Substitua pelas credenciais encontradas em: Settings > API no seu painel do Supabase
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_KEY = 'SUA_CHAVE_ANON_PUBLIC';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Buscar e Listar Stories Ativos
async function buscarStories() {
  const { data: stories, error } = await supabase
    .from('stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar stories:', error.message);
    return [];
  }

  renderizarStories(stories);
  return stories;
}

// 3. Renderizar Stories no HTML
function renderizarStories(stories) {
  const container = document.getElementById('storiesContainer');
  if (!container) return;

  container.innerHTML = '';

  if (stories.length === 0) {
    container.innerHTML = '<p>Nenhum story ativo no momento.</p>';
    return;
  }

  stories.forEach((story) => {
    const storyElement = document.createElement('div');
    storyElement.className = 'story-item';

    if (story.media_type === 'video') {
      storyElement.innerHTML = `
        <video src="${story.media_url}" controls autoplay muted width="150"></video>
      `;
    } else {
      storyElement.innerHTML = `
        <img src="${story.media_url}" alt="Story" width="150" />
      `;
    }

    container.appendChild(storyElement);
  });
}

// 4. Postar Novo Story
async function postarStory(arquivoMedia, idArtista) {
  try {
    const extensao = arquivoMedia.name.split('.').pop();
    const nomeArquivo = `${idArtista}/${Date.now()}.${extensao}`;

    // Upload do arquivo no bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('stories')
      .upload(nomeArquivo, arquivoMedia);

    if (uploadError) throw uploadError;

    // Pega URL pública
    const { data: publicUrlData } = supabase.storage
      .from('stories')
      .getPublicUrl(nomeArquivo);

    const mediaUrl = publicUrlData.publicUrl;
    const mediaType = arquivoMedia.type.startsWith('video') ? 'video' : 'image';

    // Salva no banco de dados
    const { data: storyData, error: dbError } = await supabase
      .from('stories')
      .insert([
        {
          artist_id: idArtista,
          media_url: mediaUrl,
          media_type: mediaType,
        }
      ])
      .select();

    if (dbError) throw dbError;

    // Atualiza a lista na tela após enviar
    await buscarStories();
    return storyData;

  } catch (error) {
    console.error('Erro ao postar story:', error.message);
    alert('Falha ao enviar o story.');
  }
}

// 5. Ovinte de Evento para o Formulário de Upload
document.addEventListener('DOMContentLoaded', () => {
  // Carrega os stories quando a página abre
  buscarStories();

  const formStory = document.getElementById('formStory');
  if (formStory) {
    formStory.addEventListener('submit', async (event) => {
      event.preventDefault();

      const inputMedia = document.getElementById('inputMedia');
      const arquivo = inputMedia.files[0];

      // Pegar o ID do usuário/artista logado
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Você precisa estar logado para enviar um story!');
        return;
      }

      if (!arquivo) {
        alert('Selecione uma imagem ou vídeo.');
        return;
      }

      await postarStory(arquivo, user.id);
      formStory.reset();
      alert('Story enviado com sucesso!');
    });
  }
});
