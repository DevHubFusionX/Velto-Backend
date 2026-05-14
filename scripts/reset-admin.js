require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

const NEW_EMAIL = 'admin@velto.com';
const NEW_PASSWORD = 'Admin@1234';

(async () => {
    await mongoose.connect(process.env.MONGO_URI);

    let admin = await User.findOne({ role: 'admin' });

    if (!admin) {
        console.log('No admin found. Creating one...');
        admin = await User.create({
            firstName: 'Admin',
            lastName: 'Velto',
            email: NEW_EMAIL,
            password: NEW_PASSWORD,
            role: 'admin',
        });
        console.log(`✅ Admin created — Email: ${NEW_EMAIL} | Password: ${NEW_PASSWORD}`);
    } else {
        console.log(`Found admin: ${admin.email}`);
        admin.email = NEW_EMAIL;
        admin.password = NEW_PASSWORD;
        await admin.save();
        console.log(`✅ Admin updated — Email: ${NEW_EMAIL} | Password: ${NEW_PASSWORD}`);
    }

    await mongoose.disconnect();
    process.exit(0);
})().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
