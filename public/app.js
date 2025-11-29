const titleInput = document.getElementById('titleInput');
const focusInput = document.getElementById('focusInput');
const textInput = document.getElementById('textInput');
const goalInput = document.getElementById('goalInput');
const processButton = document.getElementById('processButton');
const narrativeButton = document.getElementById('narrativeButton');
const useSampleButton = document.getElementById('useSample');
const structureOutput = document.getElementById('structureOutput');
const narrativeOutput = document.getElementById('narrativeOutput');
const processStatus = document.getElementById('processStatus');
const narrativeStatus = document.getElementById('narrativeStatus');
const uploadInput = document.getElementById('uploadFile');
const uploadMessage = document.getElementById('uploadMessage');
const clearInputButton = document.getElementById('clearInput');
const graphButton = document.getElementById('graphButton');
const graphStatus = document.getElementById('graphStatus');
const graphOutput = document.getElementById('graphOutput');
const form = document.getElementById('uploadForm');
const toastContainer = document.getElementById('toastContainer');

let currentStructure = null;

processButton.addEventListener('click', async () => {

  clearStructure();
  setStatus(processStatus, 'Generating...', true);
  toggleButtons(true);
  try {
    const payload = {
      title: titleInput.value.trim(),
      focus: focusInput.value.trim(),
      text: textInput.value.trim(),
    };

    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      showToast('Received an unexpected response from the server. Please try again.', 'error');
      throw new Error('Unexpected server response');
    }

    if (!response.ok) {
      const friendly = result?.error || 'Failed to generate RPG blueprint.';
      const code = result?.code;
      const message = code ? `${friendly} (${code})` : friendly;

      throw new Error(message);
    }

    if (Array.isArray(result.warnings) && result.warnings.includes('GROQ_PARSE_ERROR')) {
      showToast('AI response was slightly malformed. Showing best-effort result.', 'warning');
    }

    renderStructure(result);
  }
  catch (error) {
    structureOutput.classList.remove('empty-state');
    structureOutput.innerHTML = `<div class="card"><h4>Error</h4><p>${error.message}</p></div>`;
    if (!navigator.onLine) {
      showToast('You appear to be offline. Please check your internet connection.', 'error');
    } else if (error?.message) {
      showToast(error.message, 'error');
    } else {
      showToast('Something went wrong while generating the RPG blueprint.', 'error');
    }
  } finally {
    toggleButtons(false);
    setStatus(processStatus, 'Idle', false);
  }
});

narrativeButton.addEventListener('click', async () => {
  if (!currentStructure) return;
  setStatus(narrativeStatus, 'Generating...', true);
  narrativeButton.disabled = true;
  try {
    const payload = {
      structured: currentStructure,
      learningGoal: goalInput.value.trim(),
    };
    const response = await fetch('/api/narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      showToast('Received an unexpected response from the server. Please try again.', 'error');
      throw new Error('Unexpected server response');
    }

    if (!response.ok) {
      const friendly = result?.error || 'Failed to generate narrative layer.';
      const code = result?.code;
      const message = code ? `${friendly} (${code})` : friendly;
      throw new Error(message);
    }

    if (Array.isArray(result.warnings) && result.warnings.includes('GROQ_PARSE_ERROR')) {
      showToast('AI response was slightly malformed. Showing best-effort narrative.', 'warning');
    }

    renderNarrative(result);
  } catch (error) {
    narrativeOutput.classList.remove('empty-state');
    narrativeOutput.innerHTML = `<div class="card"><h4>Error</h4><p>${error.message}</p></div>`;

    if (!navigator.onLine) {
      showToast('You appear to be offline. Please check your internet connection.', 'error');
    } else if (error?.message) {
      showToast(error.message, 'error');
    } else {
      showToast('Something went wrong while generating the narrative.', 'error');
    }
  } finally {
    narrativeButton.disabled = false;
    setStatus(narrativeStatus, 'Idle', false);
  }
});

graphButton.addEventListener('click', async () => {
  if (!currentStructure) return;
  setStatus(graphStatus, 'Building...', true);
  graphButton.disabled = true;
  try {
    const payload = {
      structured: currentStructure,
      title: titleInput.value.trim(),
      focus: focusInput.value.trim(),
      savePersistently: true,
    };

    const response = await fetch('/api/graphs/from-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to generate concept graph.');
    }

    const result = await response.json();
    renderGraph(result);
  } catch (error) {
    graphOutput.classList.remove('empty-state');
    graphOutput.innerHTML = `<div class="card"><h4>Error</h4><p>${error.message}</p></div>`;
  } finally {
    graphButton.disabled = !currentStructure;
    setStatus(graphStatus, 'Idle', false);
  }
});

useSampleButton.addEventListener('click', () => {
  titleInput.value = 'Foundations of Cell Biology';
  focusInput.value = 'Intro biology, grade 9';
  textInput.value = sampleExcerpt;
});

uploadInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  uploadMessage.textContent = 'Extracting text...';
  uploadMessage.classList.add('loading');

  try {
    const extractedText = await extractTextFromFile(file);
    textInput.value = extractedText;
    uploadMessage.textContent = `Loaded ${file.name} (${extractedText.length.toLocaleString()} chars)`;
  } catch (error) {
    uploadMessage.textContent = `Could not read ${file.name}: ${error.message}`;
  } finally {
    uploadMessage.classList.remove('loading');
  }
});

clearInputButton?.addEventListener('click', () => {
  textInput.value = '';
  uploadInput.value = '';
  uploadMessage.textContent = '';
});

if (form) {
  form.addEventListener('change', () => {
    form.dispatchEvent(new Event('submit'));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fileInput = document.getElementById('uploadFile');
    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append('uploadFile', file);

    try {
      const response = await fetch('/upload?forceOCR=1', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      document.getElementById('message').innerText = data.message;

      if (data.extractedText) {
        textInput.value = data.extractedText
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      document.getElementById('message').innerText = 'Error uploading file.';
    }
  });
}
function renderStructure(result) {
  const { structured, via, title } = result;
  currentStructure = structured;
  narrativeButton.disabled = false;
  graphButton.disabled = false;
  structureOutput.classList.remove('empty-state');
  graphOutput.classList.add('empty-state');
  graphOutput.innerHTML = '<p>Build a concept graph to see dependencies.</p>';
  if (structured) {
    localStorage.setItem('textquest_structure', JSON.stringify(structured));
  }
  let html = '';

  if (structured?.levels?.length) {
    html += `<div class="badge">Source: ${title || 'Untitled'} | ${via}</div>`;
    structured.levels.forEach((level) => {
      html += `
        <article class="card">
          <h4>${level.name}</h4>
          <p>${level.overview || ''}</p>
          ${renderQuests(level.quests)}
        </article>
      `;
    });
  }

  if (structured?.vocabulary?.length) {
    html += `<article class="card"><h4>Vocabulary</h4>${structured.vocabulary
      .map((entry) => `<p><strong>${entry.term}</strong> (${entry.type}) - ${entry.description}</p>`)
      .join('')}</article>`;
  }

  if (structured?.assessments?.length) {
    html += `<article class="card"><h4>Assessments</h4>${structured.assessments
      .map((assessment) => `<p><strong>${assessment.name}</strong> | ${assessment.format} | ${assessment.success_condition}</p>`)
      .join('')}</article>`;
  }

  if (!html) {
    html = `<pre>${JSON.stringify(structured, null, 2)}</pre>`;
  }
  structureOutput.innerHTML = html;
}

function renderQuests(quests = []) {
  if (!quests.length) return '';
  return `
    <div>
      ${quests
      .map(
        (quest) => `
        <div class="card">
          <h4>${quest.title}</h4>
          <p>${quest.description || ''}</p>
          <p><strong>Items:</strong> ${quest.items?.join(', ') || 'None'}</p>
          <p><strong>Abilities:</strong> ${quest.abilities?.join(', ') || 'None'}</p>
          <p><strong>Dependencies:</strong> ${quest.dependencies?.join(', ') || 'None'}</p>
        </div>
      `
      )
      .join('')}
    </div>
  `;
}

function renderNarrative(result) {
  const { narrative, via } = result;
  narrativeOutput.classList.remove('empty-state');
  let html = `<div class="badge">Narrative | ${via}</div>`;
  if (narrative?.introduction) {
    html += `<article class="card"><h4>Overview</h4><p>${narrative.introduction}</p></article>`;
  }

  if (narrative?.regions?.length) {
    html += `<article class="card"><h4>Regions & NPCs</h4>${narrative.regions
      .map((region) => `<p><strong>${region.name}</strong> - ${region.npc}: ${region.questHook}</p>`)
      .join('')}</article>`;
  }

  if (narrative?.encounters?.length) {
    html += `<article class="card"><h4>Encounters</h4>${narrative.encounters
      .map((encounter) => `<p><strong>${encounter.name}</strong> - ${encounter.mechanic}. Reward: ${encounter.reward}</p>`)
      .join('')}</article>`;
  }

  if (narrative?.rewards?.length) {
    html += `<article class="card"><h4>Rewards</h4>${narrative.rewards
      .map((reward) => `<p><strong>${reward.name}</strong> - ${reward.benefit}</p>`)
      .join('')}</article>`;
  }

  if (!html) {
    html = `<pre>${JSON.stringify(narrative, null, 2)}</pre>`;
  }

  narrativeOutput.innerHTML = html;
}

function renderGraph(result) {
  const { graph, persistence } = result ?? {};
  if (!graph) {
    graphOutput.classList.remove('empty-state');
    graphOutput.innerHTML = `<div class="card"><h4>No graph returned</h4><p>Try building again.</p></div>`;
    return;
  }

  const topics = Object.entries(graph.metadata?.topics || {});
  const nodesPreview = (graph.nodes || []).slice(0, 6);

  graphOutput.classList.remove('empty-state');
  let html = `<div class="badge">Concept graph | ${graph.metadata?.embeddingModel || 'mock'}${persistence?.filename ? ' · saved' : ''
    }</div>`;

  html += `<article class="card">
    <h4>Overview</h4>
    <p>${graph.metadata?.totalConcepts || 0} concepts · ${graph.metadata?.totalEdges || 0} links</p>
  </article>`;

  if (topics.length) {
    html += `<article class="card"><h4>Topics</h4>${topics
      .map(([topic, data]) => {
        const avg = typeof data.avgDifficulty === 'number' ? data.avgDifficulty.toFixed(1) : 'n/a';
        return `<p><strong>${topic}</strong> · ${data.nodeCount} concepts · avg difficulty ${avg} · types: ${data.types?.join(', ') || 'n/a'
          }</p>`;
      })
      .join('')}</article>`;
  }

  if (nodesPreview.length) {
    html += `<article class="card"><h4>Highlights</h4>${nodesPreview
      .map(
        (node) =>
          `<p><strong>${node.name}</strong> (${node.type}) · ${node.topic || 'Topic'} · difficulty ${node.difficulty}</p>`
      )
      .join('')}</article>`;
  }

  graphOutput.innerHTML = html;
  localStorage.setItem('textquest_graph', JSON.stringify(graph));
}

function clearStructure() {
  currentStructure = null;
  localStorage.removeItem('textquest_structure');
  localStorage.removeItem('textquest_graph');
  narrativeButton.disabled = true;
  graphButton.disabled = true;
  structureOutput.classList.add('empty-state');
  structureOutput.innerHTML = '<p>Crunching blueprint...</p>';
  narrativeOutput.innerHTML = '<p>Narrative results will appear here.</p>';
  narrativeOutput.classList.add('empty-state');
  graphOutput.innerHTML = '<p>Concept graph will appear here.</p>';
  graphOutput.classList.add('empty-state');
}

function toggleButtons(isLoading) {
  processButton.disabled = isLoading;
  narrativeButton.disabled = isLoading || !currentStructure;
  graphButton.disabled = isLoading || !currentStructure;
}

function setStatus(el, text, loading) {
  el.textContent = text;
  el.classList.toggle('loading', loading);
}

async function extractTextFromFile(file) {
  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    return extractTextFromPdf(file);
  }
  if (typeof file.text === 'function') {
    return file.text();
  }
  throw new Error('Unsupported file type');
}

async function extractTextFromPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js failed to load');
  }

  const workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js';
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;

  let text = '';
  const maxPages = Math.min(pdf.numPages, 10);

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(' ') + '\n';
    if (text.length > 20000) break;
  }

  return text.trim();
}

function showToast(message, type = 'info') {
  if (!toastContainer || !message) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  // click to dismiss
  toast.addEventListener('click', () => {
    toast.remove();
  });

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

const sampleExcerpt = `Cells are the smallest units of life. Each cell contains organelles that specialize in a task:
the nucleus protects DNA, mitochondria create ATP, and ribosomes manufacture proteins.
When students connect each organelle to a city role, they internalize how life operates at a microscopic scale.`;
