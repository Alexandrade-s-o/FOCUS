import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleAIFileManager } from "@google/generative-ai/server";

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

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

        console.log(`Received audio file: ${req.file.path}`);

        // 1. Upload the file to Gemini
        const uploadResult = await fileManager.uploadFile(
            req.file.path,
            {
                mimeType: req.file.mimetype,
                displayName: req.file.originalname,
            }
        );

        // 2. Wait for it to be active
        await waitForFilesActive([uploadResult.file]);

        // 3. Generate content with the model
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
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

        res.json(parsedData);

    } catch (error) {
        console.error("Error processing audio:", error);
        // Cleanup physical file on error if exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to process audio', details: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { question, context } = req.body;

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

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
    if (!apiKey) console.log(`\n!!! ADD YOUR GEMINI_API_KEY TO .env TO MAKE THIS WORK !!!\n`);
});
