'use strict';

module.exports = (config) => {

    const defaults = {
        host: 'localhost',
        port: '27017',
    };

    // Merge defaults with provided config
    // config values override defaults for same keys
    config = Object.assign({}, defaults, config);

    // ── START: MongoDB protocol ──
    let uri = 'mongodb://';

    // ── CREDENTIALS ──
    if (config.username || config.user) {
        uri += config.username || config.user;
    }
    if (config.password) {
        uri += ':' + config.password;
    }
    if (config.username || config.user) {
        uri += '@';
    }

    // ── HOST ──
    uri += config.host;

    // ── PORT ──
    if (config.port) {
        uri += ':' + config.port;
    }

    // ── REPLICA SETS (optional — for high availability) ──
    if (config.replicas) {
        config.replicas.forEach((replica) => {
            uri += ',' + replica.host;
            if (replica.port) {
                uri += ':' + replica.port;
            }
        });
    }

    // ── DATABASE AND OPTIONS ──
    if (config.database || config.options) {
        uri += '/';
    }
    if (config.database) {
        uri += config.database;
    }

    // ── QUERY OPTIONS (e.g., authSource=admin) ──
    if (config.options) {
        const pairs = [];
        for (const prop in config.options) {
            if (Object.prototype.hasOwnProperty.call(config.options, prop)) {
                const k = encodeURIComponent(prop);
                const v = encodeURIComponent(config.options[prop]);
                pairs.push(k + '=' + v);
            }
        }
        // FIX: check pairs.length not pairs (empty array is truthy)
        if (pairs.length > 0) {
            uri += '?' + pairs.join('&');
        }
    }

    return uri;
};