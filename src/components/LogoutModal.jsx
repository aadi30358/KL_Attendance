import { motion, AnimatePresence } from 'framer-motion';

export default function LogoutModal({ isOpen, onClose, onConfirm }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="modal-content"
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '350px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}
          >
            <h2 style={{ marginBottom: '12px', fontSize: '1.25rem', fontWeight: 'bold' }}>Logout</h2>
            <p style={{ marginBottom: '24px', fontSize: '0.9rem', color: '#666' }}>Are you sure you want to log out? This will clear your current session.</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#f3f4f6',
                  color: '#4b5563',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
