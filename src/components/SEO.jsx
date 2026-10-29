
import { Helmet } from 'react-helmet-async';

const SEO = ({
    title = 'KL Attendance Online - KL University Attendance & LTPS Calculator',
    description = 'KL Attendance Online: Real-time attendance calculator, ERP register tracker, LTPS calculator, and safe bunk simulator for KL University (KLU) students.',
    keywords = 'kl attendance online, kl attendance, klu attendance online, kl attendance calculator, kl erp attendance, kl attendance register, kl attendance tracker, klu erp login, kl university attendance, ltps calculator, bunk simulator',
    canonical = 'https://klattendance.online/'
}) => {
    const fullTitle = title.includes('KL Attendance')
        ? title
        : `${title} | KL Attendance Online`;

    return (
        <Helmet>
            {/* Standard Metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <link rel="canonical" href={canonical} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={canonical} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:site_name" content="KL Attendance Online" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={canonical} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />

            {/* Google Site Verification */}
            <meta name="google-site-verification" content="OC_9TUs3L3oJMZAUiZj5p9T0fWO5RRD3ELmHI3H5wS4" />
        </Helmet>
    );
};

export default SEO;
