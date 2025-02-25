const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const http = require('http');

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(cors());
app.use(express.json());

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));

// ✅ Define News Schema & Model
const newsSchema = new mongoose.Schema({
    title: String,
    category: String,
    content: String,
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});
const News = mongoose.model("News", newsSchema);

// ✅ WebSocket Connection
io.on('connection', (socket) => {
    console.log('New client connected');

    // Broadcast new articles to all clients
    socket.on("new-article", async (article) => {
        const newNews = new News(article);
        await newNews.save();
        io.emit("news-update", newNews);
    });

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// ✅ API Routes

// 📰 Fetch All News
app.get("/news", async (req, res) => {
    try {
        const news = await News.find().sort({ timestamp: -1 });
        res.json(news);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 📰 Add News Article
app.post("/news", async (req, res) => {
    try {
        const newNews = new News(req.body);
        await newNews.save();
        io.emit("news-update", newNews); // Notify clients via WebSocket
        res.status(201).json(newNews);
    } catch (error) {
        res.status(500).json({ error: "Failed to add news" });
    }
});

// 📰 Get Trending News (Sorted by Views)
app.get("/news/trending", async (req, res) => {
    try {
        const trendingNews = await News.find().sort({ views: -1 }).limit(5);
        res.json(trendingNews);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch trending news" });
    }
});

// 📰 Like a News Article
app.post("/news/:id/like", async (req, res) => {
    try {
        const news = await News.findById(req.params.id);
        if (!news) return res.status(404).json({ error: "News not found" });

        news.likes += 1;
        await news.save();
        io.emit("news-update", news); // Notify clients

        res.json(news);
    } catch (error) {
        res.status(500).json({ error: "Failed to like news" });
    }
});

// ✅ Root Route
app.get("/", (req, res) => {
    res.send("📰 News API is running...");
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
