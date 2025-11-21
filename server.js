const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse')
const cors = require('cors');
const path = require('path');
const { execSync } = require('child_process');
const pdfToImages = require('./pdfToImages');
require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';

const sampleStructure = {
  levels: [
    {
      name: 'Chapter 1 - Cell Biology',
      overview: 'Explore the microscopic city inside every cell.',
      quests: [
        {
          title: 'Understanding Organelles',
          description: 'Meet the mitochondria, ribosomes, and nucleus to learn how they keep the cell alive.',
          items: ['Ribosome', 'Mitochondria'],
          abilities: ['Cell Division Spell'],
          dependencies: [],
        },
      ],
    },
    {
      name: 'Chapter 2 - Energy Flow',
      overview: 'Track how glucose becomes ATP power.',
      quests: [
        {
          title: 'Photosynthesis Primer',
          description: 'Travel to the chloroplast forest to activate the light reactions.',
          items: ['Photon Cape'],
          abilities: ['Chlorophyll Burst'],
          dependencies: ['Understanding Organelles'],
        },
      ],
    },
  ],
  vocabulary: [
    { term: 'Mitochondria', type: 'item', description: 'Power-core that boosts stamina and understanding of ATP.' },
    { term: 'Chlorophyll', type: 'skill', description: 'Lets you sense light puzzles throughout the map.' },
  ],
};

const sampleNarrative = {
  introduction:
    'Welcome to Cytopolis, a living city formed inside a single cell. As the Apprentice Biologist, your job is to stabilize the cell before it divides.',
  regions: [
    {
      name: 'Nucleus Plaza',
      npc: 'Archivist Helix',
      questHook: 'Recover the transcription scrolls to unlock advanced gene abilities.',
    },
    {
      name: 'Mitochondria Forge',
      npc: 'Engineer ATP-42',
      questHook: 'Charge three ATP cores by solving energy puzzles.',
    },
  ],
  encounters: [
    {
      name: 'Misconception Shade',
      mechanic: 'Multiple-choice riddle comparing chloroplasts and mitochondria.',
      reward: 'Blueprint for the Electron Transport skill.',
    },
  ],
  rewards: [
    {
      name: 'Concept Compass',
      benefit: 'Highlights missing quests linked to prerequisite knowledge.',
    },
  ],
};

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Files will be saved in the 'uploads/' directory
  },
  filename: function (req, file, cb) {
    const sanitized = file.originalname.replace(/\s+/g, '_')
    cb(null, `${sanitized}`);
  }
});
const upload = multer({ storage: storage });


app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/process', async (req, res) => {
  const { text, title = 'Untitled Textbook', focus = 'biology' } = req.body ?? {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const bookExcerpt = text.trim().slice(0, 5000);
  const messages = [
    {
      role: 'system',
      content:
        'You are TextQuest, an AI narrative designer that turns textbooks into lightweight RPG blueprints. Respond ONLY with valid JSON including levels, quests, vocabulary, and suggested assessments.',
    },
    {
      role: 'user',
      content: `Source textbook: ${title}\nFocus topic: ${focus}\nBuild an RPG-friendly JSON with:\n- levels: [{name, overview, quests[]}]\n- quests: {title, description, items, abilities, dependencies}\n- vocabulary: [{term, type, description}]\n- assessments: [{name, format, success_condition}]\nBase it on this excerpt:\n"""${bookExcerpt}"""`,
    },
  ];

  try {
    const { content, usage } = await callGroq(messages, { responseFormat: 'json_object' });
    const structured = safeJSON(content) ?? { raw: content };
    console.log("=== /api/process OUTPUT ===");
    console.log(JSON.stringify(structured, null, 2));
    console.log("===========================");
    return res.json({ title, structured, usage, via: 'groq' });
  } catch (error) {
    if (isMissingKeyError(error)) {
      return res.json({
        title,
        structured: sampleStructure,
        via: 'mock',
        message: 'Set GROQ_API_KEY to replace mock data.',
      });
    }
    console.error('[process] Failed', error);
    return res.status(500).json({ error: 'Failed to build RPG structure' });
  }
});

app.post('/api/narrative', async (req, res) => {
  const { structured, learningGoal = 'Keep the player curious about the topic.' } = req.body ?? {};
  if (!structured) {
    return res.status(400).json({ error: 'Structured RPG data is required' });
  }

  const trimmedStructure = JSON.stringify(structured).slice(0, 8000);
  const messages = [
    {
      role: 'system',
      content:
        'You are an imaginative yet accurate RPG writer. Given structured learning data, write concise lore, NPC hooks, and encounter ideas that reinforce the knowledge.',
    },
    {
      role: 'user',
      content: `Structured data:\n${trimmedStructure}\nLearning goal: ${learningGoal}\nReturn JSON with introduction, regions (name, npc, questHook), encounters (name, mechanic, reward), and rewards (name, benefit).`,
    },
  ];

  try {
    const { content, usage } = await callGroq(messages, { responseFormat: 'json_object' });
    const narrative = safeJSON(content) ?? { raw: content };
    console.log("=== /api/narrative OUTPUT ===");
    console.log(JSON.stringify(narrative, null, 2));
    console.log("==============================");
    return res.json({ narrative, usage, via: 'groq' });
  } catch (error) {
    if (isMissingKeyError(error)) {
      return res.json({
        narrative: sampleNarrative,
        via: 'mock',
        message: 'Set GROQ_API_KEY to replace mock data.',
      });
    }
    console.error('[narrative] Failed', error);
    return res.status(500).json({ error: 'Failed to craft narrative content' });
  }
});

async function runOCR(pdfPath) {
  try {
    const images = await pdfToImages(pdfPath);
    let fullText = "";

    const pythonPath = path.join(__dirname, "ocr_env", "Scripts", "python.exe");

    for (const img of images) {
      console.log("Running OCR on:", img);
      const command = `"${pythonPath}" ocr.py "${img}"`;
      const output = execSync(command, { encoding: "utf-8" });
      console.log("OCR raw output:", output);
      
      const jsonOut = JSON.parse(output);
      fullText += jsonOut.ocr_text + "\n";
    }

    return fullText.trim();
  } catch (err) {
    console.error("OCR failed:", err);
    return "";
  }
}

app.post('/upload', upload.single('uploadFile'), async (req, res) => {
  const forceOCR = req.query.forceOCR === "1";

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    let extractedText = pdfData.text || "";

    const isWeak = extractedText.trim().length < 50;
    const hasSuspectPages = pdfData.numpages > 0 && extractedText.split("\n").length < 5;

    if (forceOCR || isWeak || hasSuspectPages) {
      console.log("Forcing OCR...");
      const ocrText = await runOCR(req.file.path);
      extractedText = ocrText || extractedText;
    }

    res.status(200).json({
      message: "File Uploaded and Parsed Successfully",
      extractedText
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to extract PDF content.' });
  }
});

app.listen(PORT, () => {
  console.log(`TextQuest MVP server running on http://localhost:${PORT}`);
});

async function callGroq(messages, { responseFormat } = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing');
  }

  const body = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.4,
  };

  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned no content');
  }

  return { content, usage: data.usage };
}

function safeJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Failed to parse JSON response', error);
    return null;
  }
}

function isMissingKeyError(error) {
  return typeof error?.message === 'string' && error.message.includes('GROQ_API_KEY');
}


