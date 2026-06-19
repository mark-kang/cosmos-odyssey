import { Router } from 'express';
import { submitTurn } from '../controllers/turnController';

const router = Router();

router.post('/submit', submitTurn);

export default router;
