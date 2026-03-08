import express from 'express';

const router = express.Router();

/**
 * Telegram webhook endpoint
 * This will be set by the bot instance in index.js
 */
let botInstance = null;

export function setBotInstance(bot) {
  botInstance = bot;
}

// POST endpoint for Telegram webhook
router.post('/telegram', async (req, res) => {
  if (!botInstance) {
    return res.status(503).json({ error: 'Bot not initialized' });
  }

  try {
    await botInstance.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// GET endpoint for webhook verification
router.get('/telegram', (req, res) => {
  res.json({ status: 'Telegram webhook endpoint', method: 'POST' });
});

export default router;
