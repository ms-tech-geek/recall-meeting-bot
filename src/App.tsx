import React, { useState, useEffect } from 'react';
import { Video, VideoOff, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

interface Recording {
  id: string;
  status: string;
  download_url?: string;
  created_at: string;
  duration?: number;
}

interface BotStatus {
  id: string;
  status: string;
  recordings: Recording[];
  created_at: string;
  bot_name: string;
  join_at: string;
  meeting_url: {
    platform: string;
  };
}

// Get environment variables through Vite's import.meta.env
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 60000;
const POLL_INTERVAL = import.meta.env.VITE_POLL_INTERVAL || 10000;

function App() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [botId, setBotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API = axios.create({
    baseURL: 'http://localhost:3000/api',
    timeout: Number(API_TIMEOUT)
  });

  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  // Effect to start polling when botId is set
  useEffect(() => {
    if (botId) {
      console.log('Bot ID set, starting polling...');
      startPolling();
    }
  }, [botId]);

  const createBot = async () => {
    try {
      setLoading(true);
      setError(null);
      setStatus('Creating bot...');
      console.log('Creating bot with meeting URL:', meetingUrl);
      
      const response = await API.post('/create-bot', {
        meeting_url: meetingUrl
      });
      
      // Extract bot ID from response
      const newBotId = response.data.id;
      if (!newBotId) {
        throw new Error('No bot ID received from server');
      }

      console.log('Bot created with ID:', newBotId);
      setBotId(newBotId);
      setBotStatus(response.data);
      setStatus('Bot created successfully! Waiting for bot to join meeting...');
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      console.error('Error creating bot:', errorMessage);
      setError(errorMessage);
      setStatus('Failed to create bot');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval);

    console.log('Starting polling for bot status...');
    // Initial status check
    checkBotStatus();

    const interval = setInterval(() => {
      checkBotStatus();
    }, Number(POLL_INTERVAL));

    setPollingInterval(interval);
  };

  const checkBotStatus = async () => {
    if (!botId) return;

    try {
      console.log('Checking bot status for bot ID:', botId);
      const response = await API.get(`/bot/${botId}`);
      const data = response.data;
      console.log('Bot status received:', data);
      setBotStatus(data);
      setError(null);
      
      // Update recordings if available
      if (data.recordings?.length > 0) {
        setRecordings(data.recordings);
      }
      
      // Update status message based on bot status
      switch (data.status) {
        case 'joining':
          setStatus('Bot is attempting to join the meeting...');
          break;
        case 'joined':
          setStatus('Bot has successfully joined the meeting and is recording');
          break;
        case 'left':
        case 'ended':
          setStatus('Meeting has ended');
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          break;
        default:
          setStatus(`Bot status: ${data.status}`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      console.error('Error checking bot status:', errorMessage);
      setError(`Failed to get bot status: ${errorMessage}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
            <Video className="text-blue-600" />
            Meeting Bot Controller
          </h1>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="Enter Teams/Zoom/Meet URL"
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || !!botId}
              />
              <button
                onClick={createBot}
                disabled={loading || !meetingUrl || !!botId}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <LinkIcon size={18} />
                Join Meeting
              </button>
            </div>
          </div>

          {/* Bot Status Section */}
          {botStatus && (
            <div className="mb-6 p-4 rounded-md bg-gray-50">
              <h2 className="text-lg font-semibold mb-2">Bot Information</h2>
              <div className="space-y-2">
                <p><span className="font-medium">Bot ID:</span> {botStatus.id}</p>
                <p><span className="font-medium">Name:</span> {botStatus.bot_name}</p>
                <p><span className="font-medium">Status:</span> {botStatus.status}</p>
                <p><span className="font-medium">Platform:</span> {botStatus.meeting_url.platform}</p>
                <p><span className="font-medium">Created:</span> {formatDate(botStatus.created_at)}</p>
                <p><span className="font-medium">Join Time:</span> {formatDate(botStatus.join_at)}</p>
              </div>
            </div>
          )}

          {/* Status and Error Messages */}
          {(status || error) && (
            <div className={`mb-6 p-4 rounded-md ${error ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              {status && <p className="mb-2">{status}</p>}
              {error && <p className="font-medium text-red-600">{error}</p>}
            </div>
          )}

          {/* Recordings Section */}
          {recordings.length > 0 && (
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Recordings</h2>
              <div className="space-y-4">
                {recordings.map((recording) => (
                  <div key={recording.id} className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Recording {recording.id}</p>
                        <p className="text-sm text-gray-600">
                          Status: {recording.status}
                        </p>
                        {recording.duration && (
                          <p className="text-sm text-gray-600">
                            Duration: {Math.round(recording.duration / 60)} minutes
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          Created: {formatDate(recording.created_at)}
                        </p>
                      </div>
                      {recording.download_url && (
                        <a
                          href={recording.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;