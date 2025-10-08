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
      console.log(`Fetching user with UID: ${uid}`); // Debug log
      const user = await userCollection.findOne({ uid });
      
      if (!user) {
        console.log(`User not found: ${uid}`);
        return res.status(404).json({ success: false, message: "User not found" });
      }
      
      console.log(`User found:`, user); // Debug log
      res.json({ success: true, data: user });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Create user
  router.post('/', async (req, res) => {
    try {
      const { uid, name, email, age } = req.body;
      console.log("Creating user with data:", { uid, name, email, age }); // Debug log
      
      if (!uid || !name || !email) {
        return res.status(400).json({ success: false, message: "UID, name & email are required" });
      }

      const exists = await userCollection.findOne({ uid });
      if (exists) {
        return res.status(400).json({ success: false, message: "User already exists" });
      }

      const newUser = { 
        uid, 
        name, 
        email, 
        age: age || null, 
        privacySettings: {
          name: 'public',
          email: 'public', 
          age: 'public'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await userCollection.insertOne(newUser);
      console.log("User created successfully:", result.insertedId); // Debug log

      res.status(201).json({ success: true, message: "User created in MongoDB", data: newUser });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 🔹 Update user (PUT)
  router.put('/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;
      const { name, email, age, privacySettings } = req.body;
      
      console.log(`Updating user ${uid} with:`, { name, email, age, privacySettings }); // Debug log
      
      const result = await userCollection.updateOne(
        { uid },
        { $set: { name, email, age, privacySettings, updatedAt: new Date() } }
      );
      
      console.log("Update result:", result); // Debug log
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      res.json({ success: true, message: "User updated in MongoDB" });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

// 🔹 Update specific fields (PATCH) - FIXED VERSION
router.patch('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const updateData = req.body;

    console.log(`Patching user ${uid} with:`, updateData);

    // Step 1: user exists কিনা চেক কর
    const existingUser = await userCollection.findOne({ uid });
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Step 2: শুধু আপডেট করার fields গুলো prepare কর
    const updateFields = {
      ...updateData,
      updatedAt: new Date()
    };

    // Step 3: ❌ পুরো object replace করবেন না, শুধু specific fields update করুন
    const result = await userCollection.updateOne(
      { uid },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Updated user fetch করুন
    const updatedUser = await userCollection.findOne({ uid });

    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔹 Update only lastLogin (SPECIFIC ROUTE)
router.patch('/:uid/last-login', async (req, res) => {
  try {
    const uid = req.params.uid;
    
    console.log(`Updating lastLogin for user ${uid}`);

    const result = await userCollection.updateOne(
      { uid },
      { 
        $set: { 
          lastLogin: new Date(),
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Last login updated successfully"
    });
  } catch (error) {
    console.error("Error updating last login:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


  // 🔹 Update privacy settings
  router.patch('/:uid/privacy', async (req, res) => {
    try {
      const uid = req.params.uid;
      const { privacySettings } = req.body;
      
      console.log(`Updating privacy for user ${uid}:`, privacySettings); // Debug log
      
      if (!privacySettings) {
        return res.status(400).json({ success: false, message: "privacySettings is required" });
      }

      const result = await userCollection.updateOne(
        { uid },
        { $set: { privacySettings, updatedAt: new Date() } }
      );
      
      console.log("Privacy update result:", result); // Debug log
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Updated user return করতে পারেন
      const updatedUser = await userCollection.findOne({ uid });
      
      res.json({ 
        success: true, 
        message: "Privacy settings updated",
        data: updatedUser 
      });
    } catch (error) {
      console.error("Error updating privacy settings:", error);
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
      console.error("Error deleting user:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};