// Placeholder backend server - will be implemented in later tasks
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Backend API is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});