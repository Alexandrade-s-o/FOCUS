import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
    console.log('⏳ Running prisma db push...');
    execSync('node node_modules/prisma/build/index.js db push --accept-data-loss', { stdio: 'inherit' });
    console.log('✅ DB schema up to date');
} catch (e) {
    console.error('❌ DB push failed:', e.message);
}

prisma.$connect()
    .then(() => console.log('✅ Prisma connected to database'))
    .catch(e => console.error('❌ Prisma connection error:', e.message));

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
    const status = {
        server: 'ok',
        geminiKey: !!process.env.GEMINI_API_KEY,
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

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) console.warn("⚠️ Warning: GEMINI_API_KEY is not set in the .env file.");
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_INSTRUCTION = `
Eres un asistente experto organizado para creativos con TDAH.
Recibirás un audio (un briefing de un cliente o notas propias).

Tu tarea es analizarlo y devolver la información ESTRICTAMENTE en este formato JSON, sin texto extra:
{
  "title": "Un título corto (máx 5 palabras)",
  "transcript": "La transcripción exacta de lo que escuchaste",
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

        let mimeType = req.file.mimetype || 'audio/webm';
        if (mimeType.includes('webm')) mimeType = 'audio/webm';
        else if (mimeType.includes('ogg')) mimeType = 'audio/ogg';
        else if (mimeType.includes('mp4')) mimeType = 'audio/mp4';
        else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) mimeType = 'audio/mpeg';
        
        const audioData = fs.readFileSync(req.file.path);
        const base64Audio = audioData.toString('base64');
        fs.unlinkSync(req.file.path); 

        // 🛑 LO MÁS SIMPLE POSIBLE: Solo el nombre del modelo. Sin configuraciones extra.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent([
            { text: "INSTRUCCIONES:\n" + SYSTEM_INSTRUCTION },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                }
            },
            { text: "\nPor favor, analiza este audio y genera ÚNICAMENTE el JSON solicitado." }
        ]);

        // Volvemos a tu lógica original para limpiar el texto por si Gemini añade ```json
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        console.log('Gemini response (cleaned):', responseText.substring(0, 100));

        const parsedData = JSON.parse(responseText);

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
        // Lo más simple posible aquí también
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
});
