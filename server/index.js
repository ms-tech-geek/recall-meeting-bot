import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const RECALL_API_KEY = process.env.RECALL_API_KEY;
// Modified Base Url for Beta Account Setup
const RECALL_API_BASE_URL = process.env.RECALL_API_BASE_URL ;

const recallApi = axios.create({
  baseURL: RECALL_API_BASE_URL,
  headers: {
    'Authorization': `Token ${RECALL_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Create a bot and join meeting
app.post('/api/create-bot', async (req, res) => {
  try {
    const { meeting_url } = req.body;
    
    const response = await recallApi.post('/bot', {
      meeting_url,
      bot_name: 'Recording Bot',
      recording: true
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bot status
app.get('/api/bot/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const response = await recallApi.get(`/bot/${botId}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bot recordings
app.get('/api/bot/:botId/recordings', async (req, res) => {
  try {
    const { botId } = req.params;
    const response = await recallApi.get(`/bot/${botId}`);
    res.json({ recordings: response.data.recordings || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});