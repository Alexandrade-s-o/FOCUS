import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Groq, { toFile } from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function ensureSchema() {
    try {
        await prisma.$connect();
        console.log('✅ Prisma connected to database');
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Project" (
                "id" TEXT PRIMARY KEY,
                "title" TEXT NOT NULL,
                "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "transcript" TEXT NOT NULL,
                "summary" TEXT NOT NULL,
                "keyInstructions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ChecklistItem" (
                "id" TEXT PRIMARY KEY,
                "text" TEXT NOT NULL,
                "completed" BOOLEAN NOT NULL DEFAULT false,
                "projectId" TEXT NOT NULL,
                CONSTRAINT "ChecklistItem_projectId_fkey" FOREIGN KEY ("projectId")
                    REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `);
        console.log('✅ DB schema ensured (Project, ChecklistItem)');
    } catch (e) {
        console.error('❌ Schema bootstrap error:', e.message);
    }
}
ensureSchema();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// ============================================
// 🔑 GROQ CLIENT
// ============================================
const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) console.warn("⚠️ Warning: GROQ_API_KEY is not set in the .env file.");
const groq = new Groq({ apiKey: groqApiKey });

app.get('/api/health', async (req, res) => {
    const status = {
        server: 'ok',
        groqKey: !!process.env.GROQ_API_KEY,
        databaseUrl: !!process.env.DATABASE_URL,
        dbConnection: false,
        error: null
    };
    try {
        await prisma.$queryRawUnsafe('SELECT 1 as check');
        status.dbConnection = true;
    } catch (e) {
        status.error = e.message;
    }
    res.json(status);
});

const upload = multer({ dest: 'uploads/' });

const SYSTEM_INSTRUCTION = `
Eres un asistente experto organizado para creativos con TDAH.
Recibirás la transcripción de un audio (un briefing de un cliente o notas propias).

Tu tarea es analizarlo y devolver la información ESTRICTAMENTE en este formato JSON, sin texto extra, sin markdown, sin \`\`\`:
{
  "title": "Un título corto (máx 5 palabras)",
  "transcript": "La transcripción exacta que recibiste",
  "summary": "Un resumen muy claro y directo (amigable para TDAH) de qué trata el proyecto.",
  "keyInstructions": [
    "Instrucción clave 1",
    "Instrucción clave 2"
  ],
  "checklist": [
    { "id": "1", "text": "Tarea accionable corta 1", "completed": false },
    { "id": "2", "text": "Tarea accionable corta 2", "completed": false }
  ]
}
`;

app.post('/api/process-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

        console.log(`Received audio file: ${req.file.path}, mimetype: ${req.file.mimetype}`);

        // ============================================
        // PASO 1: TRANSCRIBIR CON WHISPER (GROQ)
        // ============================================
        const filename = req.file.originalname || 'recording.webm';
        const audioFile = await toFile(fs.createReadStream(req.file.path), filename);

        const transcription = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3', // El más preciso. Alternativa: 'whisper-large-v3-turbo' (más rápido y barato)
            language: 'es', // Español. Quítalo si quieres detección automática
            response_format: 'json',
            temperature: 0.0
        });

        // Limpiamos el archivo temporal
        fs.unlinkSync(req.file.path);

        const transcriptText = transcription.text;
        console.log('📝 Transcripción Whisper:', transcriptText.substring(0, 150));

        if (!transcriptText || transcriptText.trim().length === 0) {
            return res.status(400).json({ error: 'No se pudo transcribir el audio (vacío o silencioso)' });
        }

        // ============================================
        // PASO 2: ANALIZAR CON LLAMA (GROQ) -> JSON
        // ============================================
        const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile', // Modelo potente y rápido en Groq
            messages: [
                { role: 'system', content: SYSTEM_INSTRUCTION },
                { 
                    role: 'user', 
                    content: `Aquí está la transcripción del audio. Analízala y devuelve SOLO el JSON solicitado:\n\n"""${transcriptText}"""` 
                }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' } // Fuerza salida JSON válida
        });

        let responseText = chatCompletion.choices[0].message.content;
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('🤖 Respuesta Llama (cleaned):', responseText.substring(0, 100));

        const parsedData = JSON.parse(responseText);

        // Aseguramos que el transcript real sea el de Whisper, no lo que invente el LLM
        parsedData.transcript = transcriptText;

        // ============================================
        // PASO 3: GUARDAR EN DB
        // ============================================
        const savedProject = await prisma.project.create({
            data: {
                title: parsedData.title,
                transcript: parsedData.transcript,
                summary: parsedData.summary,
                keyInstructions: parsedData.keyInstructions || [],
                checklist: {
                    create: (parsedData.checklist || []).map(item => ({
                        text: item.text,
                        completed: item.completed || false
                    }))
                }
            },
            include: { checklist: true }
        });

        res.json(savedProject);

    } catch (error) {
        console.error("Error processing audio:", error.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        const details = error.message || 'Error desconocido';
        res.status(500).json({ error: 'Failed to process audio', details: details });
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            include: { checklist: true },
            orderBy: { timestamp: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        await prisma.project.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

app.put('/api/projects/:projectId/checklist/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { completed } = req.body;
        const updatedTask = await prisma.checklistItem.update({
            where: { id: taskId },
            data: { completed }
        });
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update checklist' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { question, context } = req.body;

        const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'Eres un asistente que responde dudas sobre proyectos creativos. Responde de forma concisa, directa y amigable.'
                },
                {
                    role: 'user',
                    content: `
Contexto del Proyecto (Transcripción): ${context.transcript}
Resumen: ${context.summary}
Checklist: ${JSON.stringify(context.checklist)}

Pregunta del usuario: ${question}
                    `
                }
            ],
            temperature: 0.5
        });

        res.json({ reply: chatCompletion.choices[0].message.content });

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: 'Failed chat generation' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
