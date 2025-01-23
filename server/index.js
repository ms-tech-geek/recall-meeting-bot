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

// Logger utility with enhanced details
const logger = {
  info: (message, data = {}) => {
    console.log('\x1b[36m%s\x1b[0m', '🔵 INFO:', message);
    if (Object.keys(data).length > 0) {
      console.log('\x1b[36m%s\x1b[0m', 'Details:', JSON.stringify(data, null, 2));
    }
  },
  success: (message, data = {}) => {
    console.log('\x1b[32m%s\x1b[0m', '✅ SUCCESS:', message);
    if (Object.keys(data).length > 0) {
      console.log('\x1b[32m%s\x1b[0m', 'Response Data:', JSON.stringify(data, null, 2));
    }
  },
  error: (message, error) => {
    console.error('\x1b[31m%s\x1b[0m', '❌ ERROR:', message);
    console.error('\x1b[31m%s\x1b[0m', 'Timestamp:', new Date().toISOString());
    
    if (error?.response) {
      console.error('\x1b[31m%s\x1b[0m', 'Request URL:', error.response.config.url);
      console.error('\x1b[31m%s\x1b[0m', 'Request Method:', error.response.config.method.toUpperCase());
      console.error('\x1b[31m%s\x1b[0m', 'Status Code:', error.response.status);
      console.error('\x1b[31m%s\x1b[0m', 'Response Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('\x1b[31m%s\x1b[0m', 'Response Data:', JSON.stringify(error.response.data, null, 2));
      if (error.response.config.data) {
        console.error('\x1b[31m%s\x1b[0m', 'Request Data:', JSON.stringify(JSON.parse(error.response.config.data), null, 2));
      }
    } else if (error?.request) {
      console.error('\x1b[31m%s\x1b[0m', 'Request made but no response received');
      console.error('\x1b[31m%s\x1b[0m', 'Request Details:', JSON.stringify(error.request, null, 2));
    } else {
      console.error('\x1b[31m%s\x1b[0m', 'Error Message:', error.message);
      console.error('\x1b[31m%s\x1b[0m', 'Error Stack:', error.stack);
    }
  },
  warn: (message, data = {}) => {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ WARNING:', message);
    if (Object.keys(data).length > 0) {
      console.warn('\x1b[33m%s\x1b[0m', 'Details:', JSON.stringify(data, null, 2));
    }
  }
};

const RECALL_API = axios.create({
  baseURL: RECALL_API_BASE_URL,
  headers: {
    'Authorization': `Token ${RECALL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: API_TIMEOUT
});

// Enhanced request logging
RECALL_API.interceptors.request.use(
  (config) => {
    const fullUrl = `${config.baseURL}${config.url}`;
    logger.info(`🌐 API Request`, {
      timestamp: new Date().toISOString(),
      method: config.method?.toUpperCase(),
      url: fullUrl,
      headers: config.headers,
      data: config.data,
      timeout: config.timeout
    });
    return config;
  },
  (error) => {
    logger.error('Request configuration error', error);
    return Promise.reject(error);
  }
);

// Enhanced response logging
RECALL_API.interceptors.response.use(
  (response) => {
    const fullUrl = `${response.config.baseURL}${response.config.url}`;
    logger.success(`✨ API Response Success`, {
      timestamp: new Date().toISOString(),
      url: fullUrl,
      method: response.config.method?.toUpperCase(),
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });
    return response;
  },
  (error) => {
    logger.error(`🔥 API Response Error for ${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url}`, error);
    return Promise.reject(error);
  }
);

// Utility function to handle API errors
const handleApiError = (error) => {
  if (error.response?.data) {
    return {
      error: error.response.data.detail || error.response.data.message || 'API Error',
      status: error.response.status
    };
  }
  return {
    error: error.message || 'Unknown error occurred',
    status: 500
  };
};

// Utility function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create a bot and join meeting
app.post('/api/create-bot', async (req, res) => {
  const { meeting_url } = req.body;
  logger.info('📝 Creating bot for meeting', { 
    timestamp: new Date().toISOString(),
    meeting_url,
    endpoint: '/api/create-bot'
  });

  try {
    const response = await RECALL_API.post('/bot', {
      meeting_url,
      bot_name: 'Recording Bot',
      recording: true
    });

    logger.success('🤖 Bot created successfully', response.data);
    res.json(response.data);
  } catch (error) {
    logger.error('Failed to create bot', error);
    const { error: errorMessage, status } = handleApiError(error);
    res.status(status).json({ error: errorMessage });
  }
});

// Get bot status with retries
app.get('/api/bot/:botId', async (req, res) => {
  const { botId } = req.params;
  let currentTry = 0;

  logger.info('🔍 Fetching bot status', { 
    timestamp: new Date().toISOString(),
    botId, 
    attempt: currentTry + 1,
    endpoint: `/api/bot/${botId}`
  });

  const getBotStatus = async () => {
    try {
      const response = await RECALL_API.get(`/bot/${botId}`);
      const data = response.data;
      
      if (data.status === 'joining' && currentTry < MAX_RETRIES) {
        currentTry++;
        logger.info('⏳ Bot still joining', { 
          timestamp: new Date().toISOString(),
          botId, 
          attempt: currentTry,
          maxRetries: MAX_RETRIES,
          status: data.status,
          nextRetryIn: `${RETRY_DELAY}ms`
        });
        await delay(RETRY_DELAY);
        return getBotStatus();
      }
      
      logger.success('🎯 Bot status retrieved', data);
      return data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.error('Bot not found', { botId });
        throw error;
      }
      
      currentTry++;
      if (currentTry < MAX_RETRIES) {
        logger.warn('🔄 Retrying bot status fetch', {
          timestamp: new Date().toISOString(),
          botId,
          attempt: currentTry,
          maxRetries: MAX_RETRIES,
          nextRetryIn: `${RETRY_DELAY}ms`
        });
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

  logger.info('🎥 Fetching recordings', { 
    timestamp: new Date().toISOString(),
    botId,
    endpoint: `/api/bot/${botId}/recordings`
  });

  const getRecordings = async () => {
    try {
      const response = await RECALL_API.get(`/bot/${botId}`);
      const recordings = response.data.recordings || [];
      
      if (recordings.length === 0 && currentTry < MAX_RETRIES) {
        currentTry++;
        logger.info('📭 No recordings found yet', {
          timestamp: new Date().toISOString(),
          botId,
          attempt: currentTry,
          maxRetries: MAX_RETRIES,
          nextRetryIn: `${RETRY_DELAY}ms`
        });
        await delay(RETRY_DELAY);
        return getRecordings();
      }
      
      logger.success('📼 Recordings retrieved', { 
        timestamp: new Date().toISOString(),
        botId, 
        recordingsCount: recordings.length,
        recordings
      });
      return recordings;
    } catch (error) {
      currentTry++;
      if (currentTry < MAX_RETRIES) {
        logger.warn('🔄 Retrying recordings fetch', {
          timestamp: new Date().toISOString(),
          botId,
          attempt: currentTry,
          maxRetries: MAX_RETRIES,
          nextRetryIn: `${RETRY_DELAY}ms`
        });
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
  logger.info('🚀 Server configuration', {
    timestamp: new Date().toISOString(),
    port: PORT,
    apiTimeout: API_TIMEOUT,
    maxRetries: MAX_RETRIES,
    retryDelay: RETRY_DELAY,
    recallApiBaseUrl: RECALL_API_BASE_URL
  });
  logger.success('✨ Server is running');
});