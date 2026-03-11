import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Ensure DB is connected before accepting requests
prisma.$connect()
    .then(() => console.log('✅ Prisma connected to database'))
    .catch(e => console.error('❌ Prisma connection error:', e.message));

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// ═══ Health check — abre esta URL para diagnosticar ═══
app.get('/api/health', async (req, res) => {
    const status = {
        server: 'ok',
        geminiKey: !!process.env.GEMINI_API_KEY,
        databaseUrl: !!process.env.DATABASE_URL,
        dbConnection: false,
        error: null
    };
    try {
        // Use a simple raw query that works with the pg adapter
        const result = await prisma.$queryRawUnsafe('SELECT 1 as check');
        status.dbConnection = true;
    } catch (e) {
        status.error = e.message;
    }
    res.json(status);
});

// Set up Multer for handling audio file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.warn("⚠️ Warning: GEMINI_API_KEY is not set in the .env file.");
}
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Helper to wait for file processing
async function waitForFilesActive(files) {
    for (const name of files.map((file) => file.name)) {
        let fileInfo = await fileManager.getFile(name);
        while (fileInfo.state === "PROCESSING") {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 1000));
            fileInfo = await fileManager.getFile(name);
        }
        if (fileInfo.state !== "ACTIVE") {
            throw Error(`File ${fileInfo.name} failed to process`);
        }
    }
}

// System Prompt forcing JSON output
const SYSTEM_INSTRUCTION = `
Eres un asistente experto organizado para creativos con TDAH.
Recibirás un audio (un briefing de un cliente o notas propias).

Tu tarea es analizarlo y devolver ESTRICTAMENTE un JSON con esta estructura exacta, sin texto adicional:
{
  "title": "Un título corto (máx 5 palabras)",
  "transcript": "La transcripción exacta de lo que escuchaste",
  "summary": "Un resumen muy claro y directo (amigable para TDAH) de qué trata el proyecto.",
  "keyInstructions": [
    "Instrucción clave 1",
    "Instrucción clave 2 (enfócate en colores, duraciones, estilos, etc.)"
  ],
  "checklist": [
    { "id": "1", "text": "Tarea accionable corta 1", "completed": false },
    { "id": "2", "text": "Tarea accionable corta 2", "completed": false }
  ]
}
No devuelvas bloques de código \`\`\`json, SOLO el JSON puro. Asegúrate de capturar tareas accionables para el checklist.
`;

app.post('/api/process-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log(`Received audio file: ${req.file.path}, mimetype: ${req.file.mimetype}, size: ${req.file.size}`);

        // Normalize MIME type — Android sends things like "audio/webm;codecs=opus"
        let mimeType = req.file.mimetype || 'audio/webm';
        if (mimeType.includes('webm')) mimeType = 'audio/webm';
        else if (mimeType.includes('ogg')) mimeType = 'audio/ogg';
        else if (mimeType.includes('mp4')) mimeType = 'audio/mp4';
        else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) mimeType = 'audio/mpeg';
        console.log(`Using mimeType for Gemini: ${mimeType}`);

        // 1. Upload the file to Gemini
        const uploadResult = await fileManager.uploadFile(
            req.file.path,
            {
                mimeType: mimeType,
                displayName: req.file.originalname || 'recording.webm',
            }
        );

        // 2. Wait for it to be active
        await waitForFilesActive([uploadResult.file]);

        // 3. Generate content with the model
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: SYSTEM_INSTRUCTION,
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            },
            { text: "Por favor, analiza este audio y genera el JSON solicitado." }
        ]);

        const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        // Try to parse JSON from Gemini
        const parsedData = JSON.parse(responseText);

        // Clean up temporary local file
        fs.unlinkSync(req.file.path);
        // Delete from Gemini server
        await fileManager.deleteFile(uploadResult.file.name);

        // Save to Database via Prisma
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
        // Cleanup physical file on error if exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        // Handle Gemini rate limit error specifically
        const isRateLimit = error.message?.includes('429') || error.status === 429;
        const details = isRateLimit
            ? 'Límite de cuota de Gemini alcanzado. Espera 1 minuto y vuelve a intentarlo.'
            : (error.message || 'Error desconocido');
        res.status(500).json({ error: 'Failed to process audio', details });
    }
});

// GET all projects
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            include: { checklist: true },
            orderBy: { timestamp: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// DELETE project
app.delete('/api/projects/:id', async (req, res) => {
    try {
        await prisma.project.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// PUT project checklist item
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
        console.error("Error updating checklist:", error);
        res.status(500).json({ error: 'Failed to update checklist' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { question, context } = req.body;

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
Eres un asistente que responde dudas sobre este proyecto creativo.
Contexto del Proyecto (Transcripción): ${context.transcript}
Resumen: ${context.summary}
Checklist: ${JSON.stringify(context.checklist)}

Pregunta del usuario: ${question}

Responde de forma concisa, directa y amigable.
        `;

        const result = await model.generateContent(prompt);
        res.json({ reply: result.response.text() });

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: 'Failed chat generation' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${port}`);
    if (!apiKey) console.log(`\n!!! ADD YOUR GEMINI_API_KEY TO .env TO MAKE THIS WORK !!!\n`);
});
