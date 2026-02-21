
import { Helmet } from 'react-helmet-async';

const SEO = ({
    title = 'Home',
    description = 'The ultimate academic assistant for KLU students. Track attendance, calculate LTPS, and chat with Jarvis.',
    keywords = 'KLU, KL University, Attendance, LTPS, Study Hub, Jarvis AI'
}) => {
    return (
        <Helmet>
            {/* Standard Metadata */}
            <title>{title} | KL Attendance Manager</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:title" content={`${title} | KL Attendance Manager`} />
            <meta property="og:description" content={description} />
            <meta property="og:site_name" content="KL Attendance Manager" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={`${title} | KL Attendance Manager`} />
            <meta name="twitter:description" content={description} />

            {/* Google Site Verification (Placeholder) */}
            <meta name="google-site-verification" content="OC_9TUs3L3oJMZAUiZj5p9T0fWO5RRD3ELmHI3H5wS4" />
        </Helmet>
    );
};

export default SEO;
