import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import turnRoutes from './routes/turn';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/turn', turnRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Project We-Go Server is running!' });
});

app.listen(port, () => {
  console.log(`[Server] Project We-Go server is running at http://localhost:${port}`);
});
