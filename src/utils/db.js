const fs = require('fs');
const path = require('path');
const mockData = require('../data/mockData');

const DB_FILE = path.join(__dirname, '../data/db.json');

const db = {
    init: () => {
        if (!fs.existsSync(DB_FILE)) {
            // First time initialization with mock data
            const initialData = {
                user: mockData.user,
                dashboard: {
                    ...mockData.dashboard,
                    lockedBalance: 0 // New field for withdrawals
                },
                platformSettings: mockData.platformSettings,
                products: mockData.products,
                opportunities: mockData.opportunities,
                notifications: mockData.notifications,
                posts: mockData.posts,
                kycApprovals: mockData.kycApprovals
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            console.log('Database initialized with mock data.');
        }
    },

    read: () => {
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading database:', error);
            return mockData; // Fallback
        }
    },

    write: (data) => {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error writing to database:', error);
            return false;
        }
    },

    // Helper to get specific tables
    getData: (key) => {
        const data = db.read();
        return data[key];
    },

    // Helper to update specific tables
    setData: (key, value) => {
        const data = db.read();
        data[key] = value;
        return db.write(data);
    }
};

db.init();

module.exports = db;
