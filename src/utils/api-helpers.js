/**
 * Executes an API call with exponential backoff retry mechanism
 * @param {Function} apiCall - Async function that makes the API request
 * @param {number} [retries=3] - Maximum number of retry attempts
 * @returns {Promise<any>} - Result from the API call
 * @throws {Error} - Throws if all retry attempts fail
 */
async function withRetry(apiCall, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
}

module.exports = {
    withRetry
};
