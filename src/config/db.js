const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // New parser options are default in Mongoose 6+, but good to be explicit if using older versions
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;
