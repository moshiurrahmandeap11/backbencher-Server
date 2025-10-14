const express = require('express');

module.exports = (pool, admin) => {
    const router = express.Router();

    router.get("/", async(req, res) => {
        try {
            const result = await pool.query(
                'SELECT * FROM subscribers ORDER BY subscriberd_at DESC'
            );

            res.json({
                success: true,
                message: "Subscribers fetched successfully",
                data: result.rows,
                count: result.rowCount
            });
        } catch (error) {
            console.error("Error fetching subscribers:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch subscribers",
                error: error.message
            });
        }
    });

    // get single subscriber by ID
    router.get("/:id", async(req, res) => {
        try {
            const {id} = req.params;

            const result = await pool.query(
                'SELECT * FROM subscribers WHERE id = $1', [id]
            );

            if(result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Subscriber not found"
                });
            }
            res.json({
                success: true,
                message: "Subscriber fetched successfully",
                data: result.rows[0]
            });
        } catch (error) {
            console.error("Error fetching subscriber:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch subscriber",
                error: error.message
            });
        }
    });

    // create a new subscriber
    router.post("/", async(req, res) => {
        try {
            const {email} = req.body;

            if(!email){
                return res.status(400).json({
                    success: false,
                    message: "Email is required"
                });
            }

            // email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if(!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address"
                });
            }

            // check if email already exists
            const existingSubscriber = await pool.query(
                'SELECT * FROM subscribers WHERE email = $1', [email]
            );

            if(existingSubscriber.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Email already subscribed"
                });
            }

            // insert new subscriber
            const result = await pool.query(
                'INSERT INTO subscribers (email) VALUES ($1) RETURNING *', [email]
            );

            res.status(201).json({
                success: true,
                message: "Subscribed successfully",
                data: result.rows[0]
            });

        } catch (error) {
            console.error("Error creating subscriber:", error);
            res.status(500).json({
                success: false,
                message: "Failed to subscribe",
                error: error.message
            });
        }
    });

    // put by id
    router.put("/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const { email, is_active } = req.body;

            // Check if subscriber exists
            const existingSubscriber = await pool.query(
                'SELECT * FROM subscribers WHERE id = $1',
                [id]
            );

            if (existingSubscriber.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Subscriber not found"
                });
            }

            // Update subscriber
            const result = await pool.query(
                'UPDATE subscribers SET email = $1, is_active = $2 WHERE id = $3 RETURNING *',
                [email, is_active, id]
            );

            res.json({
                success: true,
                message: "Subscriber updated successfully",
                data: result.rows[0]
            });

        } catch (error) {
            console.error("Error updating subscriber:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update subscriber",
                error: error.message
            });
        }
    });

    // delete subscriber
    router.delete("/:id", async (req, res) => {
        try {
            const { id } = req.params;

            // Check if subscriber exists
            const existingSubscriber = await pool.query(
                'SELECT * FROM subscribers WHERE id = $1',
                [id]
            );

            if (existingSubscriber.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Subscriber not found"
                });
            }

            // Delete subscriber
            await pool.query(
                'DELETE FROM subscribers WHERE id = $1',
                [id]
            );

            res.json({
                success: true,
                message: "Subscriber deleted successfully"
            });

        } catch (error) {
            console.error("Error deleting subscriber:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete subscriber",
                error: error.message
            });
        }
    });

    // patch for toggle
    router.patch("/:id/toggle", async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(
                'UPDATE subscribers SET is_active = NOT is_active WHERE id = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Subscriber not found"
                });
            }

            const status = result.rows[0].is_active ? 'activated' : 'deactivated';

            res.json({
                success: true,
                message: `Subscription ${status} successfully`,
                data: result.rows[0]
            });

        } catch (error) {
            console.error("Error toggling subscription:", error);
            res.status(500).json({
                success: false,
                message: "Failed to toggle subscription",
                error: error.message
            });
        }
    });

    // GET - Subscriber statistics
    router.get("/stats/summary", async (req, res) => {
        try {
            const totalResult = await pool.query('SELECT COUNT(*) FROM subscribers');
            const activeResult = await pool.query('SELECT COUNT(*) FROM subscribers WHERE is_active = true');
            const inactiveResult = await pool.query('SELECT COUNT(*) FROM subscribers WHERE is_active = false');
            const recentResult = await pool.query(
                'SELECT COUNT(*) FROM subscribers WHERE subscriberd_at >= CURRENT_DATE - INTERVAL \'7 days\''
            );

            res.json({
                success: true,
                data: {
                    total: parseInt(totalResult.rows[0].count),
                    active: parseInt(activeResult.rows[0].count),
                    inactive: parseInt(inactiveResult.rows[0].count),
                    recent: parseInt(recentResult.rows[0].count)
                }
            });

        } catch (error) {
            console.error("Error fetching stats:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch statistics",
                error: error.message
            });
        }
    });

    return router;
};