// Notification.jsx
import "./Notification.css";

export default function Notification({
                                         title,
                                         description,
                                         onClose,
                                     }) {
    return (
        <div className="notification">
            <div className="notification-header">
                <span>{title}</span>

                <button onClick={onClose}>×</button>
            </div>

            <div className="notification-content">
                {description}
            </div>
        </div>
    );
}