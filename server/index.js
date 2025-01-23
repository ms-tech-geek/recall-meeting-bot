import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_API_BASE_URL = process.env.RECALL_API_BASE_URL;
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '60000');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '10');
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '5000');

const RECALL_API = axios.create({
  baseURL: RECALL_API_BASE_URL,
  headers: {
    'Authorization': `Token ${RECALL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: API_TIMEOUT
});

// Utility function to handle API errors
const handleApiError = (error) => {
  if (error.response?.data) {
    console.error('API Error:', error.response.data);
    return {
      error: error.response.data.detail || error.response.data.message || 'API Error',
      status: error.response.status
    };
  }
  console.error('Error:', error.message);
  return {
    error: error.message || 'Unknown error occurred',
    status: 500
  };
};

// Utility function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create a bot and join meeting
app.post('/api/create-bot', async (req, res) => {
  try {
    const { meeting_url } = req.body;
    
    const response = await RECALL_API.post('/bot', {
      meeting_url,
      bot_name: 'Recording Bot',
      recording: true
    });

    res.json(response.data);
  } catch (error) {
    const { error: errorMessage, status } = handleApiError(error);
    res.status(status).json({ error: errorMessage });
  }
});

// Get bot status with retries
app.get('/api/bot/:botId', async (req, res) => {
  const { botId } = req.params;
  let currentTry = 0;

  const getBotStatus = async () => {
    try {
      const response = await RECALL_API.get(`/bot/${botId}`);
      const data = response.data;
      
      // If bot is still joining, wait and retry
      if (data.status === 'joining' && currentTry < MAX_RETRIES) {
        currentTry++;
        console.log(`Bot still joining. Attempt ${currentTry}/${MAX_RETRIES}`);
        await delay(RETRY_DELAY);
        return getBotStatus();
      }
      
      return data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw error;
      }
      
      currentTry++;
      if (currentTry < MAX_RETRIES) {
        console.log(`Error getting status. Retrying... Attempt ${currentTry}/${MAX_RETRIES}`);
        await delay(RETRY_DELAY);
        return getBotStatus();
      }
      throw error;
    }
  };

  try {
    const botData = await getBotStatus();
    res.json(botData);
  } catch (error) {
    const { error: errorMessage, status } = handleApiError(error);
    res.status(status).json({ error: errorMessage });
  }
});

// Get recordings with retries
app.get('/api/bot/:botId/recordings', async (req, res) => {
  const { botId } = req.params;
  let currentTry = 0;

  const getRecordings = async () => {
    try {
      const response = await RECALL_API.get(`/bot/${botId}`);
      const recordings = response.data.recordings || [];
      
      // If no recordings yet and not max retries, wait and retry
      if (recordings.length === 0 && currentTry < MAX_RETRIES) {
        currentTry++;
        console.log(`No recordings yet. Attempt ${currentTry}/${MAX_RETRIES}`);
        await delay(RETRY_DELAY);
        return getRecordings();
      }
      
      return recordings;
    } catch (error) {
      currentTry++;
      if (currentTry < MAX_RETRIES) {
        console.log(`Error getting recordings. Retrying... Attempt ${currentTry}/${MAX_RETRIES}`);
        await delay(RETRY_DELAY);
        return getRecordings();
      }
      throw error;
    }
  };

  try {
    const recordings = await getRecordings();
    res.json({ recordings });
  } catch (error) {
    const { error: errorMessage, status } = handleApiError(error);
    res.status(status).json({ error: errorMessage });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Timeout: ${API_TIMEOUT}ms`);
  console.log(`Max Retries: ${MAX_RETRIES}`);
  console.log(`Retry Delay: ${RETRY_DELAY}ms`);
});