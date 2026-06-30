import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
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

// 클라이언트 빌드 아웃풋 (client/dist) 정적 호스팅 연동 (실행 워킹 디렉토리 기준 매핑)
const clientDistPath = path.resolve(process.cwd(), '../client/dist');
app.use(express.static(clientDistPath));

// 그 외 모든 요청을 SPA 구조에 따라 index.html 로 라우팅 리디렉션 (미들웨어 우회 처리)
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`[Server] Project We-Go server is running at http://0.0.0.0:${port}`);
});
