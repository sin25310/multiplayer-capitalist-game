const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 游戏数据存储
const gameState = {
    players: new Map(),
    globalMarket: {
        food: { price: 2, trend: 0, volume: 0 },
        materials: { price: 3, trend: 1, volume: 0 },
        knowledge: { price: 8, trend: -1, volume: 0 },
        tools: { price: 5, trend: 0, volume: 0 },
        trade: { price: 4, trend: 1, volume: 0 },
        magic: { price: 15, trend: 0, volume: 0 },
        equipment: { price: 12, trend: -1, volume: 0 },
        souls: { price: 20, trend: 1, volume: 0 }
    },
    tradeOffers: [],
    chatMessages: [],
    serverStartTime: Date.now()
};

console.log('🎮 多人地精资本家服务器启动中...');

// 玩家连接处理
io.on('connection', (socket) => {
    console.log('🔗 玩家连接:', socket.id);
    
    socket.on('joinGame', (data) => {
        const { playerName, gameData } = data;
        
        const playerData = {
            id: socket.id,
            name: playerName,
            gameData: gameData || createNewPlayer(),
            online: true,
            lastSeen: Date.now(),
            socket: socket
        };
        
        gameState.players.set(socket.id, playerData);
        
        socket.emit('gameState', {
            globalMarket: gameState.globalMarket,
            players: getPlayerList(),
            tradeOffers: gameState.tradeOffers,
            chatMessages: gameState.chatMessages.slice(-50)
        });
        
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            name: playerName
        });
        
        addChatMessage('系统', `${playerName} 加入了游戏！`);
        console.log(`👤 玩家 ${playerName} 加入游戏`);
    });
    
    socket.on('updateGameData', (gameData) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.gameData = gameData;
            player.lastSeen = Date.now();
        }
    });
    
    socket.on('marketTrade', (data) => {
        const { action, resource, amount } = data;
        const player = gameState.players.get(socket.id);
        
        if (player && gameState.globalMarket[resource]) {
            const market = gameState.globalMarket[resource];
            
            if (action === 'buy' && player.gameData.resources.money >= market.price * amount) {
                player.gameData.resources.money -= market.price * amount;
                player.gameData.resources[resource] += amount;
                market.volume += amount;
                market.price = Math.max(1, market.price + Math.floor(amount / 10));
                
                socket.emit('tradeSuccess', { action, resource, amount, newPrice: market.price });
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💰 ${player.name} 购买了 ${amount} 个 ${resource}`);
            }
            else if (action === 'sell' && player.gameData.resources[resource] >= amount) {
                player.gameData.resources[resource] -= amount;
                player.gameData.resources.money += market.price * amount;
                market.volume += amount;
                market.price = Math.max(1, market.price - Math.floor(amount / 20));
                
                socket.emit('tradeSuccess', { action, resource, amount, newPrice: market.price });
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💱 ${player.name} 卖出了 ${amount} 个 ${resource}`);
            }
        }
    });
    
    socket.on('chatMessage', (message) => {
        const player = gameState.players.get(socket.id);
        if (player && message.trim()) {
            addChatMessage(player.name, message.trim());
            console.log(`💬 ${player.name}: ${message.trim()}`);
        }
    });
    
    socket.on('disconnect', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.online = false;
            
            socket.broadcast.emit('playerLeft', {
                id: socket.id,
                name: player.name
            });
            
            addChatMessage('系统', `${player.name} 离开了游戏`);
            console.log(`👋 玩家 ${player.name} 断开连接`);
            
            // 24小时后删除玩家数据
            setTimeout(() => {
                gameState.players.delete(socket.id);
            }, 24 * 60 * 60 * 1000);
        }
    });
});

function createNewPlayer() {
    return {
        resources: {
            money: 100, food: 0, materials: 0, knowledge: 0,
            tools: 0, trade: 0, magic: 0, equipment: 0, souls: 0
        },
        professions: {
            beggar: { count: 0, cost: { money: 10 } },
            street_vendor: { count: 0, cost: { money: 25 } },
            farmer: { count: 0, cost: { money: 40 } },
            factory_worker: { count: 0, cost: { money: 60, food: 5 } }
        },
        buildings: {},
        efficiency: 1.0,
        happiness: 1.0,
        evilLevel: 1,
        evilExp: 0,
        lastUpdate: Date.now()
    };
}

function getPlayerList() {
    return Array.from(gameState.players.values()).map(player => ({
        id: player.id,
        name: player.name,
        online: player.online,
        wealth: calculateWealth(player.gameData),
        lastSeen: player.lastSeen
    })).sort((a, b) => b.wealth - a.wealth);
}

function calculateWealth(gameData) {
    let wealth = gameData.resources.money;
    Object.keys(gameData.resources).forEach(resource => {
        if (resource !== 'money' && gameState.globalMarket[resource]) {
            wealth += gameData.resources[resource] * gameState.globalMarket[resource].price;
        }
    });
    return wealth;
}

function addChatMessage(playerName, message) {
    const chatMessage = {
        player: playerName,
        message: message,
        timestamp: Date.now()
    };
    
    gameState.chatMessages.push(chatMessage);
    
    if (gameState.chatMessages.length > 200) {
        gameState.chatMessages.shift();
    }
    
    io.emit('chatMessage', chatMessage);
}

// 定期更新市场价格
setInterval(() => {
    Object.keys(gameState.globalMarket).forEach(resource => {
        const market = gameState.globalMarket[resource];
        const randomChange = (Math.random() - 0.5) * 0.15;
        
        market.price = Math.max(1, Math.floor(market.price * (1 + randomChange)));
        market.trend = randomChange > 0.05 ? 1 : randomChange < -0.05 ? -1 : 0;
        market.volume = Math.floor(market.volume * 0.9);
    });
    
    io.emit('marketUpdate', gameState.globalMarket);
    console.log('📈 市场价格已更新');
}, 60000); // 每分钟更新一次

// 定期更新玩家列表
setInterval(() => {
    io.emit('playersUpdate', getPlayerList());
}, 15000); // 每15秒更新一次

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 多人地精资本家服务器运行在端口 ${PORT}`);
    console.log(`🌐 如果在本地运行，访问: http://localhost:${PORT}`);
    console.log(`📱 多人游戏已启动，等待玩家连接...`);
});
