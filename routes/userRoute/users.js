const express = require('express');

module.exports = (userCollection, admin) => {
  const router = express.Router();

  // 🔹 Get all users
  router.get('/', async (req, res) => {
    try {
      const users = await userCollection.find().toArray();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Get user by UID
  router.get('/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;
      const user = await userCollection.findOne({ uid });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Create user
  router.post('/', async (req, res) => {
    try {
      const { uid, name, email, age } = req.body;
      if (!uid || !name || !email) {
        return res.status(400).json({ success: false, message: "UID, name & email are required" });
      }

      const exists = await userCollection.findOne({ uid });
      if (exists) {
        return res.status(400).json({ success: false, message: "User already exists" });
      }

      const newUser = { uid, name, email, age: age || null, createdAt: new Date() };
      

      await userCollection.insertOne(newUser);

      res.status(201).json({ success: true, message: "User created in MongoDB", data: newUser });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update user (PUT)
  router.put('/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;
      const { name, email, age } = req.body;
      

      const result = await userCollection.updateOne(
        { uid },
        { $set: { name, email, age, updatedAt: new Date() } }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      res.json({ success: true, message: "User updated in MongoDB" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Delete user from MongoDB + Firebase Auth
  router.delete('/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;


      const result = await userCollection.deleteOne({ uid });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: "User not found in MongoDB" });
      }


      await admin.auth().deleteUser(uid);

      res.json({ success: true, message: "User deleted from MongoDB and Firebase Auth" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
