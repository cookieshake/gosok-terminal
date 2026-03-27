import { useEventsContext } from '../contexts/EventsContext';
import { X } from 'lucide-react';

interface InboxPanelProps {
  onClose: () => void;
}

export default function InboxPanel({ onClose }: InboxPanelProps) {
  const { messages, clearInbox } = useEventsContext();

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Inbox</h2>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearInbox}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">No messages</p>
        ) : (
          <div className="space-y-3">
            {messages.map(m => (
              <div key={m.id} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500">
                    {m.from_tab_id ? m.from_tab_id.slice(0, 8) : 'system'}
                  </span>
                  <span className="text-xs text-gray-300">
                    {m.scope === 'broadcast' ? 'broadcast' : 'direct'}
                  </span>
                  <span className="text-xs text-gray-300 ml-auto">
                    {new Date(m.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
