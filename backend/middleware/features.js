/**
 * Middleware to restrict API endpoints based on environment feature flags.
 * Returns a 404 Not Found response when the feature is disabled.
 * @param {string} featureKey - Environment variable key (e.g. 'VITE_ENABLE_COMMUNITIES')
 */
export const requireFeature = (featureKey) => {
    return (req, res, next) => {
        const isEnabled = process.env[featureKey] === 'true';
        if (!isEnabled) {
            return res.status(404).json({
                error: `Not Found: The requested workspace team feature is currently disabled.`
            });
        }
        next();
    };
};
