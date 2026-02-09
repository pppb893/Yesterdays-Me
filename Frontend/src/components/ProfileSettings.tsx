import React, { useState, useEffect } from 'react';
import '../App.css';

interface ProfileSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: { displayName: string; avatar: string; username: string };
    onUpdate: (data: { displayName: string; avatar: string }) => Promise<void>;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ isOpen, onClose, currentUser, onUpdate }) => {
    const [displayName, setDisplayName] = useState(currentUser.displayName || '');
    const [avatar, setAvatar] = useState(currentUser.avatar || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setDisplayName(currentUser.displayName || '');
        setAvatar(currentUser.avatar || '');
    }, [currentUser]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onUpdate({ displayName, avatar });
        setLoading(false);
        onClose();
    };

    const emojis = ['🙂', '😎', '🥳', '🤯', '🦁', '🐱', '🦊', '🚀', '🌟', '🌙', '🎵', '🎨', '📚', '☕', '💡', '🔥'];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content profile-modal-glass" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>แก้ไขโปรไฟล์</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="profile-preview-section">
                        <div className="avatar-preview-ring">
                            {avatar ? <span className="avatar-xl">{avatar}</span> : <div className="avatar-placeholder-xl">{currentUser.username[0]?.toUpperCase()}</div>}
                            <button type="button" className="edit-avatar-hint" onClick={() => setAvatar('')}>✎</button>
                        </div>
                        <p className="preview-label">@{currentUser.username}</p>
                    </div>

                    <div className="form-section">
                        <label className="section-label">ชื่อที่แสดง</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="ชื่อของคุณคือ?"
                                className="modern-input"
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <label className="section-label">เลือกรูปประจำตัว</label>
                        <div className="emoji-grid-modern">
                            {emojis.map(emoji => (
                                <button
                                    type="button"
                                    key={emoji}
                                    className={`emoji-choice ${avatar === emoji ? 'active' : ''}`}
                                    onClick={() => setAvatar(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <div className="custom-avatar-input">
                            <input
                                type="text"
                                placeholder="หรือวางอีโมจิ/URL ที่นี่"
                                value={avatar}
                                onChange={(e) => setAvatar(e.target.value)}
                                className="modern-input-small"
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn-ghost">ยกเลิก</button>
                        <button type="submit" disabled={loading} className="btn-gradient">
                            {loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileSettings;
