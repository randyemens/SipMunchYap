import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Allow your frontend to make requests to this API
app.use(cors());
app.use(express.json());

// Health check endpoint for Fly.io and monitoring
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Fly.io defaults to port 8080 and requires binding to 0.0.0.0
const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});