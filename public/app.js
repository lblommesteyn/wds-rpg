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
const form = document.getElementById('uploadForm');

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

    if (!response.ok) {
      throw new Error('Failed to generate RPG blueprint.');
    }

    const result = await response.json();
    renderStructure(result);
  } 
  catch (error) {
    structureOutput.classList.remove('empty-state');
    structureOutput.innerHTML = `<div class="card"><h4>Error</h4><p>${error.message}</p></div>`;
  } 
  finally {
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
    if (!response.ok) {
      throw new Error('Failed to generate narrative layer.');
    }
    const result = await response.json();
    renderNarrative(result);
  } catch (error) {
    narrativeOutput.classList.remove('empty-state');
    narrativeOutput.innerHTML = `<div class="card"><h4>Error</h4><p>${error.message}</p></div>`;
  } finally {
    narrativeButton.disabled = false;
    setStatus(narrativeStatus, 'Idle', false);
  }
});

useSampleButton.addEventListener('click', () => {
  titleInput.value = 'Foundations of Cell Biology';
  focusInput.value = 'Intro biology, grade 9';
  textInput.value = sampleExcerpt;
});

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

    textInput.value = data.extractedText

  } catch (error) {
    console.error('Error uploading file:', error);
    document.getElementById('message').innerText = 'Error uploading file.';
  }
});

function renderStructure(result) {
  const { structured, via, title } = result;
  currentStructure = structured;
  narrativeButton.disabled = false;
  structureOutput.classList.remove('empty-state');
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

function clearStructure() {
  currentStructure = null;
  narrativeButton.disabled = true;
  structureOutput.classList.add('empty-state');
  structureOutput.innerHTML = '<p>Crunching blueprint...</p>';
  narrativeOutput.innerHTML = '<p>Narrative results will appear here.</p>';
  narrativeOutput.classList.add('empty-state');
}

function toggleButtons(isLoading) {
  processButton.disabled = isLoading;
  narrativeButton.disabled = isLoading || !currentStructure;
}

function setStatus(el, text, loading) {
  el.textContent = text;
  el.classList.toggle('loading', loading);
}

const sampleExcerpt = `Cells are the smallest units of life. Each cell contains organelles that specialize in a task:
the nucleus protects DNA, mitochondria create ATP, and ribosomes manufacture proteins.
When students connect each organelle to a city role, they internalize how life operates at a microscopic scale.`;
