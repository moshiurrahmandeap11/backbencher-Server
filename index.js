require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const admin = require('firebase-admin');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Firebase Admin SDK initialization
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`
});

const user = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;

// MongoDB connection URI
const uri = `mongodb+srv://${user}:${password}@mdb.26vlivz.mongodb.net/?retryWrites=true&w=majority&appName=MDB`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// connect MongoDB
async function run() {
  try {
    await client.connect();
    console.log(" Connected to MongoDB");

    const db = client.db("backbencherDB"); // DB name
    const userCollection = db.collection("users"); // Collection name

    // inject collection and admin into routes
    const userRoutes = require("./routes/userRoute/users")(userCollection, admin);
    app.use('/bb/v1/users', userRoutes);

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

run();

// default route
app.get('/', (req, res) => {
  res.send(' Backbencher Coder API is running');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});