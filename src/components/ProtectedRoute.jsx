
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ADMIN_EMAILS } from '../config/admin';

const ProtectedRoute = ({ children }) => {
    const { currentUser } = useAuth();

    // While loading auth state, you might want a loader, but context handles initial load usually.
    // Assuming currentUser is null if not logged in.

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email) || !isLocalhost) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
