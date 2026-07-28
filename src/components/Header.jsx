import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header({ title = "KL Attendance" }) {
  const navigate = useNavigate();

  return (
    <header style={{
      backgroundColor: '#2196F3',
      color: 'white',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={() => navigate('/')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'white', 
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>{title}</h1>
      </div>
      
    </header>
  );
}

