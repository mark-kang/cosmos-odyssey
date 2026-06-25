import { Router } from 'express';
import { submitTurn, getTurnStatus, resetGame, getGameState } from '../controllers/turnController';

const router = Router();

router.post('/submit', submitTurn);
router.get('/status', getTurnStatus);
router.post('/reset', resetGame);
router.get('/state', getGameState);

export default router;
