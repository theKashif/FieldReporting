import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import {connectDatabase} from './config/database';
import reportRoutes from './routes/reportRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => {
  res.json({status: 'ok', message: 'Field Reporting API is running.'});
});

app.use('/api/reports', reportRoutes);

// Handle Multer errors and other middleware errors.
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('API error:', error);

    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({message: 'Each image must be 5 MB or smaller.'});
      return;
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({message: 'Maximum 5 images are allowed.'});
      return;
    }

    res.status(400).json({
      message: error.message || 'Invalid request.',
    });
  },
);

async function startServer() {
  try {
    await connectDatabase();

    const port = Number(process.env.PORT) || 5000;

    app.listen(port, '0.0.0.0', () => {
      console.log(`API running on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();