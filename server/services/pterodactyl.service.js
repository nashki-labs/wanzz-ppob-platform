/**
 * Pterodactyl Panel Service
 * Handles all interactions with the Pterodactyl Panel API.
 * Reference: sc1/index.js (lines 1264-1342)
 */

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import crypto from 'crypto';
import db from '../database.js';

// Helper to get configuration from DB with fallback to ENV
export function getPteroConfig() {
    try {
        const domainRow = db.prepare("SELECT value FROM settings WHERE key = 'ptero_domain'").get();
        const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'ptero_api_key'").get();
        const domain = domainRow?.value || process.env.PTERO_DOMAIN || '';
        const apiKey = apiKeyRow?.value || process.env.PTERO_PLTA_API_KEY || '';

        return {
            domain: domain.replace(/\/+$/, ''),
            apiKey: apiKey,
            eggId: process.env.PTERO_EGG_ID || '15',
            locationId: process.env.PTERO_LOCATION_ID || '1',
            dockerImage: process.env.PTERO_DOCKER_IMAGE || 'ghcr.io/parkervcp/yolks:nodejs_20'
        };
    } catch (err) {
        console.error('⚠️ [PTERO] Error reading config from DB, falling back to ENV:', err.message);
        return {
            domain: (process.env.PTERO_DOMAIN || '').replace(/\/+$/, ''),
            apiKey: process.env.PTERO_PLTA_API_KEY || '',
            eggId: process.env.PTERO_EGG_ID || '15',
            locationId: process.env.PTERO_LOCATION_ID || '1',
            dockerImage: process.env.PTERO_DOCKER_IMAGE || 'ghcr.io/parkervcp/yolks:nodejs_20'
        };
    }
}

// ============================
// PANEL PACKAGES CONFIGURATION
// ============================


/**
 * Get dynamic packages from database settings.
 * Falls back to hardcoded defaults if not found.
 */
export function getDynamicPackages() {
    try {
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'ptero_packages'").get();
        if (setting && setting.value) {
            return JSON.parse(setting.value);
        }
    } catch (err) {
        console.error('❌ [PTERO] Error fetching packages from DB:', err.message);
    }

    // Default Fallback
    return {
        '1gb': { memo: 1024, cpu: 30, disk: 1024, price: 5000, label: '1 GB' },
        '2gb': { memo: 2048, cpu: 60, disk: 2048, price: 8000, label: '2 GB' },
        '3gb': { memo: 3072, cpu: 90, disk: 3072, price: 12000, label: '3 GB' },
        '4gb': { memo: 4096, cpu: 120, disk: 4096, price: 15000, label: '4 GB' },
        '5gb': { memo: 5120, cpu: 150, disk: 5120, price: 18000, label: '5 GB' },
        '6gb': { memo: 6144, cpu: 180, disk: 6144, price: 22000, label: '6 GB' },
        '7gb': { memo: 7168, cpu: 210, disk: 7168, price: 25000, label: '7 GB' },
        '8gb': { memo: 8192, cpu: 240, disk: 8192, price: 28000, label: '8 GB' },
        '9gb': { memo: 9216, cpu: 270, disk: 9216, price: 32000, label: '9 GB' },
        '10gb': { memo: 10240, cpu: 300, disk: 10240, price: 35000, label: '10 GB' },
        'unli': { memo: 0, cpu: 0, disk: 0, price: 50000, label: 'Unlimited' },
    };
}

// Default startup command (from sc1)
const DEFAULT_STARTUP = 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\\n"); for line in $vars; do export $line; done fi; /usr/local/bin/${CMD_RUN};';

// ============================
// VALIDATION
// ============================
export function isPterodactylConfigured() {
    const config = getPteroConfig();
    return !!(config.domain && config.apiKey);
}

// ============================
// KNOWN EGG VARIABLE DEFAULTS
// ============================
// Some panels have eggs without proper variable definitions in the DB.
// Pterodactyl still validates these from the startup command template.
// This map provides sensible defaults for common egg variables.
const KNOWN_VARIABLE_DEFAULTS = {
    // Node.js eggs
    'CMD_RUN': 'node index.js',
    'AUTO_UPDATE': '0',
    'NODE_PACKAGES': '',
    'UNNODE_PACKAGES': '',
    'CUSTOM_ENVIRONMENT_VARIABLES': '',
    'USER_UPLOAD': 'true',
    // Python eggs
    'PY_FILE': 'app.py',
    'PY_PACKAGES': '',
    'REQUIREMENTS_FILE': 'requirements.txt',
    // Git-related
    'GIT_ADDRESS': '',
    'BRANCH': '',
    'USERNAME': '',
    'ACCESS_TOKEN': '',
    // Java/Minecraft eggs (including hidden vars required by Pterodactyl)
    'SERVER_JARFILE': 'server.jar',
    'MINECRAFT_VERSION': 'latest',
    'BUILD_NUMBER': 'latest',
    'BUILD_TYPE': 'recommended',
    'SPONGE_VERSION': 'latest',
    'BUNGEE_VERSION': 'latest',
    'MC_VERSION': 'latest',
    'FORGE_VERSION': 'latest',
    'DL_PATH': '',
    'DL_VERSION': 'latest',
    // Source Engine
    'SRCDS_APPID': '',
    'SRCDS_GAME': '',
    'SRCDS_MAP': '',
    'STEAM_ACC': '',
    'STEAM_AUTH': '',
    'SERVER_PORT': '27015',
    'MAX_PLAYERS': '20',
    'TICKRATE': '64',
    // Garrys Mod
    'WORKSHOP_ID': '',
    'GAMEMODE': 'sandbox',
    // Ark: Survival Evolved
    'SERVER_MAP': 'TheIsland',
    'SESSION_NAME': 'Ark Server',
    'ARK_PASSWORD': '',
    'ARK_ADMIN_PASSWORD': 'admin',
    'RCON_PORT': '27020',
    'QUERY_PORT': '27016',
    'MOD_ID': '',
    'ARGS': '',
    'ARK_PID': '',
    // Rust
    'HOSTNAME': 'Rust Server',
    'LEVEL': 'Procedural Map',
    'DESCRIPTION': '',
    'SERVER_URL': '',
    'SERVER_IMG': '',
    'SERVER_LOGO': '',
    'RCON_PASS': 'changeme',
    'SAVEINTERVAL': '300',
    'APP_PORT': '',
    'WORLD_SIZE': '3000',
    'WORLD_SEED': '',
    'MAP_URL': '',
    'ADDITIONAL_ARGS': '',
    // Teamspeak
    'FILE_TRANSFER': '30033',
    'QUERY_HTTP': '',
    'QUERY_SSH': '',
    'QUERY_PROTOCOLS_VAR': '',
    'SERVERADMIN_PASSWORD': '',
    // Misc
    'STARTUP': '',
};


/**
 * Parse startup command or install script to extract referenced variable names.
 * Catches both {{VAR}} and ${VAR} patterns.
 * @param {string} text - The text to parse (startup cmd or install script)
 * @returns {string[]} - List of unique variable names
 */
function parseVariablesFromText(text) {
    if (!text) return [];
    const vars = new Set();
    // Match {{VAR_NAME}} pattern
    const mustacheRegex = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
    let match;
    while ((match = mustacheRegex.exec(text)) !== null) {
        vars.add(match[1]);
    }
    // Match ${VAR_NAME} or $VAR_NAME pattern
    const shellRegex = /\$\{?([A-Z_][A-Z0-9_]*)\}?/g;
    while ((match = shellRegex.exec(text)) !== null) {
        vars.add(match[1]);
    }
    return [...vars];
}

// ============================
// API HELPERS
// ============================
async function pteroFetch(endpoint, options = {}) {
    const config = getPteroConfig();
    if (!config.domain || !config.apiKey) {
        throw new Error('Pterodactyl belum dikonfigurasi. Periksa Pengaturan di Admin Panel atau .env');
    }

    const url = `${config.domain}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            ...options.headers,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        const errorMsg = data.errors
            ? data.errors.map(e => e.detail || e.message || JSON.stringify(e)).join(', ')
            : `HTTP ${response.status}`;
        throw new Error(`Pterodactyl API Error: ${errorMsg}`);
    }

    return data;
}

// ============================
// USER MANAGEMENT
// ============================

/**
 * Find a user on Pterodactyl by their email.
 * @param {string} email - User email
 * @returns {Promise<object|null>} - Pterodactyl user attributes or null
 */
export async function getPterodactylUserByEmail(email) {
    try {
        const data = await pteroFetch(`/api/application/users?filter[email]=${encodeURIComponent(email)}`);
        return data.data.length > 0 ? data.data[0].attributes : null;
    } catch (err) {
        console.error('❌ [PTERO] Error searching user by email:', err.message);
        return null;
    }
}

/**
 * Create a new user on the Pterodactyl panel.
 * @param {string} username - Unique username for the panel
 * @param {string} email - Real user email
 * @returns {object} - Pterodactyl user attributes
 */
export async function createPterodactylUser(username, email) {
    const password = crypto.randomBytes(16).toString('hex');

    const data = await pteroFetch('/api/application/users', {
        method: 'POST',
        body: JSON.stringify({
            email,
            username,
            first_name: username,
            last_name: 'Panel',
            language: 'en',
            password,
        }),
    });

    return {
        ...data.attributes,
        _password: password, // Store temporarily for user
        _email: email,
    };
}

/**
 * Delete a user from the Pterodactyl panel.
 * @param {number} pteroUserId - Pterodactyl internal user ID
 */
export async function deletePterodactylUser(pteroUserId) {
    await pteroFetch(`/api/application/users/${pteroUserId}`, {
        method: 'DELETE',
    });
}

// ============================
// EGG MANAGEMENT
// ============================

/**
 * Find a default egg dynamically. 
 * Defaults to searching for Node.js for broad compatibility.
 * @returns {Promise<object|null>} - Egg detail object or null
 */
export async function findDefaultEgg() {
    try {
        const eggs = await listAllEggs();

        // Search for Node.js egg as a safe default
        const defaultEgg = eggs.find(egg => {
            const name = egg.attributes.name.toLowerCase();
            return name.includes('node.js') || name.includes('nodejs');
        });

        if (defaultEgg) {
            // Fetch full details with variables
            return await getEggDetails(defaultEgg.attributes.id, defaultEgg.attributes.nest_id);
        }
        return null;
    } catch (err) {
        console.error('❌ [PTERO] Error finding default egg:', err.message);
        return null;
    }
}

/**
 * List all available eggs from the panel, flattens them.
 * Useful for finding specific eggs globally.
 * NOTE: This does NOT include variables. Use getEggDetails() for that.
 * @returns {Promise<Array>} - List of eggs with their attributes
 */
export async function listAllEggs() {
    try {
        const nests = await listNestsWithEggs();
        let allEggs = [];
        for (const nest of nests) {
            const eggs = nest.attributes.relationships?.eggs?.data || [];
            allEggs = allEggs.concat(eggs);
        }
        return allEggs;
    } catch (err) {
        console.error('❌ [PTERO] Error listing all eggs:', err.message);
        throw err;
    }
}

/**
 * List all nests including their eggs (but NOT egg variables).
 * Use `?include=eggs` only — nested includes like `eggs.variables` are not supported.
 * For variables, use getEggDetails() per-egg.
 */
export async function listNestsWithEggs() {
    try {
        const nestsData = await pteroFetch('/api/application/nests?include=eggs');
        return nestsData.data;
    } catch (err) {
        console.error('❌ [PTERO] Error listing nests with eggs:', err.message);
        return [];
    }
}

/**
 * List all available locations from the panel.
 * @returns {Promise<Array>} - List of locations
 */
export async function listAllLocations() {
    try {
        const data = await pteroFetch('/api/application/locations');
        return data.data;
    } catch (err) {
        console.error('❌ [PTERO] Error listing locations:', err.message);
        return [];
    }
}

/**
 * Find a default location (first one available) if not configured.
 */
export async function findDefaultLocation() {
    const locations = await listAllLocations();
    if (locations && locations.length > 0) {
        return locations[0].attributes.id;
    }
    return null;
}

/**
 * Get specific egg details by ID, ALWAYS fetching fresh from the specific API endpoint.
 * This ensures we get the full variable definitions required for server creation.
 * 
 * API: GET /api/application/nests/{nest}/eggs/{egg}?include=variables
 * 
 * @param {number} eggId - The egg ID
 * @param {number} [nestId] - Optional nest ID (if known). Will be auto-detected if not provided.
 * @returns {Promise<object|null>} - Egg details with variables, or null
 */
export async function getEggDetails(eggId, nestId = null) {
    console.log(`🔍 [PTERO] getEggDetails called for egg ${eggId}, nestId=${nestId}`);

    // Step 1: If nestId not provided, find it
    if (!nestId) {
        const eggs = await listAllEggs();
        const cachedEgg = eggs.find(e => e.attributes.id === parseInt(eggId));
        nestId = cachedEgg?.attributes?.nest_id || cachedEgg?.attributes?.nest;
        console.log(`📋 [PTERO] Found nestId=${nestId} from cached egg list`);
    }

    if (!nestId) {
        console.error(`❌ [PTERO] Cannot find nest_id for egg ${eggId}`);
        return null;
    }

    // Step 2: ALWAYS fetch fresh from the specific egg endpoint with ?include=variables
    try {
        console.log(`� [PTERO] Fetching: /api/application/nests/${nestId}/eggs/${eggId}?include=variables`);
        const response = await pteroFetch(`/api/application/nests/${nestId}/eggs/${eggId}?include=variables`);

        // The response for a single resource is: { object: "egg", attributes: {...}, relationships: {...} }
        const attrs = response.attributes;
        const rels = response.relationships || {};
        const vars = rels.variables?.data || [];

        console.log(`✅ [PTERO] Egg ${eggId} (${attrs?.name}) fetched. Variables: ${vars.length}`);
        vars.forEach(v => {
            console.log(`   📌 ${v.attributes.env_variable} = "${v.attributes.default_value || ''}"`);
        });

        return {
            id: attrs.id,
            nest_id: attrs.nest_id,
            name: attrs.name,
            docker_image: attrs.docker_image,
            startup: attrs.startup,
            relationships: rels,
        };
    } catch (err) {
        console.error(`❌ [PTERO] Error fetching egg ${eggId} details from API:`, err.message);
        return null;
    }
}

// ============================
// SERVER MANAGEMENT
// ============================

/**
 * Create a new server on the Pterodactyl panel.
 * @param {number} pteroUserId - Pterodactyl internal user ID
 * @param {string} serverName - Name for the server
 * @param {object} sizeConfig - Package config (memo, cpu, disk)
 * @param {number} eggId - Specific egg ID to use
 * @returns {object} - Pterodactyl server attributes
 */
export async function createPterodactylServer(pteroUserId, serverName, sizeConfig, eggId = null) {
    let eggIdToUse = eggId ? parseInt(eggId) : null;
    let dockerImage = '';
    let startup = DEFAULT_STARTUP;

    // Automated Location Detection
    const config = getPteroConfig();
    const locationId = parseInt(config.locationId) || await findDefaultLocation();
    if (!locationId) {
        throw new Error('No location available on Pterodactyl panel.');
    }

    let eggVariables = {};

    if (eggIdToUse) {
        // Fetch full egg details with variables
        const egg = await getEggDetails(eggIdToUse);
        if (egg) {
            dockerImage = egg.docker_image;
            startup = egg.startup;

            // Extract all default variables — Pterodactyl requires these in the environment object
            const vars = egg.relationships?.variables?.data || [];
            console.log(`📦 [PTERO] Egg ${eggIdToUse} has ${vars.length} API-defined variables.`);

            vars.forEach(v => {
                const key = v.attributes.env_variable;
                const value = v.attributes.default_value;
                eggVariables[key] = value !== null && value !== undefined ? String(value) : '';
            });

            // FALLBACK: If API returns 0 variables, parse from startup command AND install script
            if (vars.length === 0) {
                const combinedText = (startup || '') + ' ' + (egg.script?.install || '');
                const parsedVars = parseVariablesFromText(combinedText);
                console.log(`🔄 [PTERO] No API variables found. Parsed ${parsedVars.length} from text: ${parsedVars.join(', ')}`);

                parsedVars.forEach(varName => {
                    if (!(varName in eggVariables)) {
                        eggVariables[varName] = KNOWN_VARIABLE_DEFAULTS[varName] || '';
                    }
                });

                // Extra safety: Always inject common mandatory variables if they aren't there
                const mandatory = ['SERVER_JARFILE', 'MINECRAFT_VERSION', 'BUILD_NUMBER', 'USER_UPLOAD', 'AUTO_UPDATE'];
                mandatory.forEach(m => {
                    if (!(m in eggVariables) && (m in KNOWN_VARIABLE_DEFAULTS)) {
                        eggVariables[m] = KNOWN_VARIABLE_DEFAULTS[m];
                    }
                });
            }
        } else {
            console.error(`❌ [PTERO] Could not fetch egg details for egg ${eggIdToUse}. Server creation will likely fail.`);
        }
    } else {
        // Fallback to dynamic detection if no eggId provided
        const dynamicEgg = await findDefaultEgg();
        eggIdToUse = dynamicEgg ? dynamicEgg.id : parseInt(config.eggId);
        dockerImage = dynamicEgg ? dynamicEgg.docker_image : config.dockerImage;
        startup = dynamicEgg ? dynamicEgg.startup : DEFAULT_STARTUP;

        // Extract default variables for fallback egg
        if (dynamicEgg) {
            const vars = dynamicEgg.relationships?.variables?.data || [];
            vars.forEach(v => {
                const key = v.attributes.env_variable;
                const value = v.attributes.default_value;
                eggVariables[key] = value !== null && value !== undefined ? String(value) : '';
            });
            // FALLBACK: parse startup if no API variables
            if (vars.length === 0 && startup) {
                const parsedVars = parseStartupVariables(startup);
                console.log(`🔄 [PTERO] Fallback: Parsed ${parsedVars.length} vars from startup: ${parsedVars.join(', ')}`);
                parsedVars.forEach(varName => {
                    if (!(varName in eggVariables)) {
                        eggVariables[varName] = KNOWN_VARIABLE_DEFAULTS[varName] || '';
                    }
                });
            }
        }
    }

    console.log(`🚀 [PTERO] Creating server — Egg: ${eggIdToUse}, Docker: ${dockerImage}`);
    console.log(`� [PTERO] Environment variables:`, JSON.stringify(eggVariables, null, 2));

    const payload = {
        name: serverName,
        description: `Panel created via Wanzz PPOB - ${new Date().toISOString()}`,
        user: pteroUserId,
        egg: eggIdToUse,
        docker_image: dockerImage,
        startup: startup,
        environment: {
            ...eggVariables,
            ...sizeConfig.env,
        },
        limits: {
            memory: sizeConfig.memo,
            swap: 0,
            disk: sizeConfig.disk,
            io: 500,
            cpu: sizeConfig.cpu
        },
        feature_limits: {
            databases: 1,
            allocations: 1,
            backups: 1
        },
        deploy: {
            locations: [locationId],
            dedicated_ip: false,
            port_range: []
        },
        start_on_completion: true
    };

    console.log(`📡 [PTERO] Sending POST /api/application/servers...`);
    const data = await pteroFetch('/api/application/servers', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    return data.attributes;
}

/**
 * Delete a server from the Pterodactyl panel.
 * @param {number} pteroServerId - Pterodactyl internal server ID
 */
export async function deletePterodactylServer(pteroServerId) {
    await pteroFetch(`/api/application/servers/${pteroServerId}`, {
        method: 'DELETE',
    });
}

/**
 * Get server details from the Pterodactyl panel.
 * @param {number} pteroServerId - Pterodactyl internal server ID
 * @returns {object} - Server attributes
 */
export async function getPterodactylServer(pteroServerId) {
    const data = await pteroFetch(`/api/application/servers/${pteroServerId}`);
    return data.attributes;
}
