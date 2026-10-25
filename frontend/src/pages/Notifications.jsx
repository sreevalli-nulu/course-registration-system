import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { errorText } from "../utils/format";
import "../notifications.css";

function timeAgo(isoText) {
  // The server stores UTC without a "Z", so add it before parsing.
  const date = new Date(isoText.endsWith("Z") ? isoText : `${isoText}Z`);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;

  return date.toLocaleDateString();
}

function Notifications() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await api.get("/notifications");
    setItems(response.data.notifications);
    setUnreadCount(response.data.unread_count);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await load();
        if (!cancelled) setError("");
      } catch (err) {
        if (!cancelled) {
          setError(errorText(err, "Unable to load notifications."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const notifyNavbar = () => window.dispatchEvent(new Event("notifications-updated"));

  const markRead = async (item) => {
    if (item.is_read) return;

    try {
      await api.put(`/notifications/${item.id}/read`);
      await load();
      notifyNavbar();
    } catch (err) {
      setError(errorText(err, "Unable to update this notification."));
    }
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      await load();
      notifyNavbar();
    } catch (err) {
      setError(errorText(err, "Unable to update notifications."));
    }
  };

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up."}
          </p>
        </div>

        <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>
          Mark all as read
        </button>
      </header>

      {loading ? (
        <p>Loading notifications...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : items.length === 0 ? (
        <p>
          No notifications yet. You'll be notified here when you move off a
          waitlist or a grade is posted.
        </p>
      ) : (
        <div className="notification-list">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`notification-item ${item.is_read ? "" : "unread"}`}
              onClick={() => markRead(item)}
            >
              <span className="notification-dot" aria-hidden="true" />
              <span className="notification-body">
                <p>{item.message}</p>
                <small>{timeAgo(item.created_at)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

export default Notifications;
