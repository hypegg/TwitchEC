const logger = require('./logger');

class MemoryManager {
    constructor(options = {}) {
        this.maxHeapUsage = options.maxHeapUsage || 0.9; // 90% of max heap
        this.cleanupThreshold = options.cleanupThreshold || 0.8; // 80% triggers cleanup
        this.staleDataAge = options.staleDataAge || 30 * 24 * 60 * 60 * 1000; // 30 days
        this.checkInterval = options.checkInterval || 5 * 60 * 1000; // 5 minutes
        this.isRunningCleanup = false;
        this.startTime = Date.now();
        this.minRuntimeBeforeCleanup = options.minRuntimeBeforeCleanup || 30 * 60 * 1000; // 30 minutes
    }

    getHeapUsage() {
        const used = process.memoryUsage();
        return {
            heapUsed: used.heapUsed,
            heapTotal: used.heapTotal,
            usage: used.heapUsed / used.heapTotal,
            external: used.external,
            rss: used.rss
        };
    }

    needsCleanup() {
        if (Date.now() - this.startTime < this.minRuntimeBeforeCleanup) {
            return false;
        }

        const { usage } = this.getHeapUsage();
        return usage > this.cleanupThreshold;
    }

    logMemoryUsage() {
        const usage = this.getHeapUsage();
        logger.debug('Memory Usage:', {
            heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            usage: `${(usage.usage * 100).toFixed(1)}%`,
            external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
            rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`
        });
    }

    isStale(timestamp) {
        return Date.now() - timestamp > this.staleDataAge;
    }

    async performCleanup(data, isStaleCallback) {
        if (!data) return 0;
        
        const initialCount = Object.keys(data).length;
        let cleanedCount = 0;

        for (const [key, value] of Object.entries(data)) {
            if (isStaleCallback(value)) {
                delete data[key];
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.warn('Memory cleanup completed:', {
                removed: cleanedCount,
                total: initialCount,
                percentRemoved: ((cleanedCount / initialCount) * 100).toFixed(1) + '%'
            });

            if (global.gc) {
                global.gc();
            }
        }

        return cleanedCount;
    }

    async freeMemory(data) {
        if (data) {
            data = null;
            if (global.gc) {
                global.gc();
            }
            logger.debug('Memory freed successfully');
        }
    }

    setupMemoryMonitoring(options = {}) {
        const {
            logInterval = 5 * 60 * 1000,  // 5 minutes
            checkInterval = 15 * 60 * 1000,  // 15 minutes
            growthThreshold = 100 * 1024 * 1024  // 100MB
        } = options;

        // Log memory usage periodically
        setInterval(() => {
            this.logMemoryUsage();
        }, logInterval);

        // Monitor for memory leaks
        let lastHeapUsed = 0;
        setInterval(() => {
            const { heapUsed } = this.getHeapUsage();
            const growth = heapUsed - lastHeapUsed;
            
            if (growth > growthThreshold) {
                logger.warn('Significant memory growth detected:', {
                    growth: `${(growth / 1024 / 1024).toFixed(2)}MB`
                });
            }
            
            lastHeapUsed = heapUsed;
        }, checkInterval);
    }
}

module.exports = MemoryManager; 