
import React from 'react';

interface LogoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-icon">⚠️</div>
                <h3>ยืนยันการออกจากระบบ</h3>
                <p>คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?</p>
                <div className="modal-buttons">
                    <button className="btn-secondary" onClick={onClose}>ยกเลิก</button>
                    <button
                        className="btn-primary"
                        style={{ background: 'hsl(0, 70%, 60%)', color: 'white', border: 'none' }}
                        onClick={onConfirm}
                    >
                        ออกจากระบบ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogoutModal;
