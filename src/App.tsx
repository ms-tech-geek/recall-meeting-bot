import React, { useState, useEffect } from 'react';
import { Video, VideoOff, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

function App() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [botId, setBotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const createBot = async () => {
    try {
      setLoading(true);
      setStatus('Creating bot and joining meeting...');
      
      const response = await axios.post('http://localhost:3000/api/create-bot', {
        meeting_url: meetingUrl
      });
      
      setBotId(response.data.bot_id);
      setStatus('Bot successfully joined the meeting!');
      
      // Start polling for bot status
      startPolling(response.data.bot_id);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      setStatus('Error creating bot: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id: string) => {
    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`http://localhost:3000/api/bot/${id}`);
        const botStatus = response.data.status;
        const currentRecordings = response.data.recordings || [];
        
        setStatus(`Bot status: ${botStatus}`);
        
        // Update recordings if they exist
        if (currentRecordings.length > 0) {
          setRecordings(currentRecordings);
        }
        
        // Check for meeting end conditions
        if (botStatus === 'ended' || botStatus === 'left') {
          clearInterval(interval);
          setStatus('Meeting ended. Waiting for recordings...');
          
          // Wait 10 seconds before final recordings check
          setTimeout(() => getRecordings(id), 10000);
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || error.message;
        setStatus('Error checking bot status: ' + errorMessage);
        
        // Don't clear interval on temporary errors
        if (error.response?.status === 404) {
          clearInterval(interval);
          setStatus('Bot not found or expired');
        }
      }
    }, 5000);

    setPollingInterval(interval);
  };

  const getRecordings = async (id: string) => {
    try {
      setStatus('Fetching final recordings...');
      const response = await axios.get(`http://localhost:3000/api/bot/${id}/recordings`);
      const newRecordings = response.data.recordings || [];
      
      if (newRecordings.length > 0) {
        setRecordings(newRecordings);
        setStatus('Recordings are ready!');
      } else {
        setStatus('No recordings found. They might be still processing...');
        // Try again in 30 seconds if no recordings found
        setTimeout(() => getRecordings(id), 30000);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      setStatus('Error fetching recordings: ' + errorMessage);
    }
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
            <div className="mb-6 p-4 bg-gray-50 rounded-md">
              <p className="text-gray-700">{status}</p>
            </div>
          )}

          {recordings.length > 0 && (
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Recordings</h2>
              <div className="space-y-4">
                {recordings.map((recording, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Recording {index + 1}</p>
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