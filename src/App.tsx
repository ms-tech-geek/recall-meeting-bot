import { useState, useEffect } from 'react';
import { Video, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

interface Recording {
  id: string;
  status: string;
  download_url?: string;
  created_at: string;
  duration?: number;
}

function App() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [botId, setBotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const RECALL_API_KEY = import.meta.env.VITE_RECALL_API_KEY;
  const RECALL_API = axios.create({
    baseURL: import.meta.env.VITE_RECALL_API_BASE_URL,
    headers: {
      'Authorization': `Token ${RECALL_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  const createBot = async () => {
    try {
      setLoading(true);
      setStatus('Creating bot and joining meeting...');
      
      const response = await RECALL_API.post('/bot', {
        meeting_url: meetingUrl,
        bot_name: 'Recording Bot',
        recording: true
      });
      
      setBotId(response.data.bot_id);
      setStatus('Bot created! Waiting to join meeting...');
      startPolling(response.data.bot_id);
    } catch (error: any) {
      console.error('Create bot error:', error.response?.data || error.message);
      setStatus('Error creating bot: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id: string) => {
    if (pollingInterval) clearInterval(pollingInterval);

    const interval = setInterval(async () => {
      try {
        const response = await RECALL_API.get(`/bot/${id}`);
        const botStatus = response.data.status;
        const currentRecordings = response.data.recordings || [];
        
        switch (botStatus) {
          case 'joining':
            setStatus('Bot is joining the meeting...');
            break;
          case 'joined':
            setStatus('Bot has joined the meeting and is recording');
            break;
          case 'left':
          case 'ended':
            setStatus('Meeting ended. Checking recordings...');
            clearInterval(interval);
            setPollingInterval(null);
            if (currentRecordings.length > 0) {
              setRecordings(currentRecordings);
              setStatus('Recordings are ready!');
            }
            break;
          default:
            setStatus(`Bot status: ${botStatus}`);
        }
        
        if (currentRecordings.length > 0) {
          setRecordings(currentRecordings);
        }
      } catch (error: any) {
        console.error('Poll error:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.detail || error.message;
        setStatus(`Error checking status: ${errorMsg}`);
        
        if (error.response?.status === 404) {
          clearInterval(interval);
          setPollingInterval(null);
          setStatus('Bot not found or session expired');
        }
      }
    }, 5000);

    setPollingInterval(interval);
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
              />
              <button
                onClick={createBot}
                disabled={loading || !meetingUrl}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <LinkIcon size={18} />
                Join Meeting
              </button>
            </div>
          </div>

          {status && (
            <div className={`mb-6 p-4 rounded-md ${status.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
              <p>{status}</p>
            </div>
          )}

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