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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 游戏状态
const gameState = {
    companies: new Map(),
    aiCompanies: [
        {
            name: '咬一口科技',
            value: 15800000,
            trend: 1,
            sector: '科技',
            companyType: 'tech',
            evilQuote: '创新就是把用户隐私包装成个性化服务'
        },
        {
            name: '巨硬垄断集团',
            value: 14200000,
            trend: 0,
            sector: '软件',
            companyType: 'tech',
            evilQuote: '开源？那是什么？能赚钱吗？'
        },
        {
            name: '狗狗搜索引擎',
            value: 13600000,
            trend: -1,
            sector: '互联网',
            companyType: 'tech',
            evilQuote: '不作恶？我们早就删掉这个口号了'
        },
        {
            name: '压马逊剥削物流',
            value: 12800000,
            trend: 1,
            sector: '电商',
            companyType: 'retail',
            evilQuote: '员工的眼泪是最好的包装材料'
        },
        {
            name: '脸书社交监控',
            value: 11400000,
            trend: -1,
            sector: '社交',
            companyType: 'tech',
            evilQuote: '元宇宙就是现实世界不够糟，我们再造一个'
        },
        {
            name: '特死啦忽悠汽车',
            value: 10200000,
            trend: 1,
            sector: '汽车',
            companyType: 'manufacturing',
            evilQuote: '全自动驾驶：让机器来承担撞死人的责任'
        },
        {
            name: '奈飞沉迷工厂',
            value: 9600000,
            trend: 0,
            sector: '娱乐',
            companyType: 'entertainment',
            evilQuote: '用算法绑架用户时间，然后说是个性化推荐'
        },
        {
            name: '字节跳动洗脑机',
            value: 8800000,
            trend: 1,
            sector: '短视频',
            companyType: 'entertainment',
            evilQuote: '让用户停不下来是我们的核心竞争力'
        },
        {
            name: '腾讯氪金帝国',
            value: 8200000,
            trend: -1,
            sector: '游戏',
            companyType: 'entertainment',
            evilQuote: '游戏设计的终极目标：让玩家上瘾并掏空钱包'
        },
        {
            name: '高盛吸血银行',
            value: 7600000,
            trend: 0,
            sector: '金融',
            companyType: 'finance',
            evilQuote: '经济危机？那是我们的发财机会！'
        },
        {
            name: '辉瑞天价药业',
            value: 7000000,
            trend: 1,
            sector: '制药',
            companyType: 'pharma',
            evilQuote: '治愈疾病不赚钱，管理疾病才是王道'
        },
        {
            name: '沃尔玛压榨超市',
            value: 6400000,
            trend: -1,
            sector: '零售',
            companyType: 'retail',
            evilQuote: '低价的秘诀：把成本转嫁给员工和社会'
        }
    ],
    globalMarket: {
        workforce: { price: 25000, trend: 0, volume: 0 },
        materials: { price: 18000, trend: 1, volume: 0 },
        technology: { price: 80000, trend: -1, volume: 0 },
        energy: { price: 35000, trend: 0, volume: 0 },
        data: { price: 45000, trend: 1, volume: 0 },
        reputation: { price: 60000, trend: 0, volume: 0 },
        influence: { price: 150000, trend: 1, volume: 0 }
    },
    chatMessages: [],
    serverStartTime: Date.now()
};

console.log('🏢 黑心公司大亨服务器启动中...');

// 玩家连接处理
io.on('connection', (socket) => {
    console.log('🔗 新CEO连接:', socket.id);
    
    socket.on('joinGame', (data) => {
        const { companyName, playerName, companyType, gameData } = data;
        
        const companyData = {
            id: socket.id,
            name: companyName,
            playerName: playerName,
            companyType: companyType || 'tech',
            gameData: gameData || createNewCompany(companyType),
            online: true,
            lastSeen: Date.now(),
            socket: socket
        };
        
        gameState.companies.set(socket.id, companyData);
        
        socket.emit('gameState', {
            globalMarket: gameState.globalMarket,
            leaderboard: getLeaderboard(),
            chatMessages: gameState.chatMessages.slice(-50)
        });
        
        socket.broadcast.emit('companyJoined', {
            id: socket.id,
            name: companyName
        });
        
        const companyTypeNames = {
            tech: '科技', manufacturing: '制造', finance: '金融',
            retail: '零售', entertainment: '娱乐', pharma: '制药'
        };
        
        addChatMessage('系统', `${companyName}(${companyTypeNames[companyType] || '未知'})进入了商业战场！又来一个黑心企业！`);
        console.log(`🏢 公司 ${companyName}(${companyType}) 加入游戏`);
    });
    
    socket.on('updateGameData', (gameData) => {
        const company = gameState.companies.get(socket.id);
        if (company) {
            company.gameData = gameData;
            company.lastSeen = Date.now();
        }
    });
    
    socket.on('marketTrade', (data) => {
        const { action, resource, amount } = data;
        const company = gameState.companies.get(socket.id);
        
        if (company && gameState.globalMarket[resource]) {
            const market = gameState.globalMarket[resource];
            
            if (action === 'buy' && company.gameData.resources.money >= market.price * amount) {
                company.gameData.resources.money -= market.price * amount;
                company.gameData.resources[resource] += amount;
                market.volume += amount;
                
                // 购买推高价格
                market.price = Math.max(5000, market.price + Math.floor(amount * market.price * 0.02));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount, 
                    message: `购买了${amount}单位${resource}` 
                });
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💰 ${company.name} 购买了 ${amount} 个 ${resource}`);
            }
            else if (action === 'sell' && company.gameData.resources[resource] >= amount) {
                company.gameData.resources[resource] -= amount;
                company.gameData.resources.money += market.price * amount;
                market.volume += amount;
                
                // 出售降低价格
                market.price = Math.max(5000, market.price - Math.floor(amount * market.price * 0.015));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount, 
                    message: `卖出了${amount}单位${resource}` 
                });
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💱 ${company.name} 卖出了 ${amount} 个 ${resource}`);
            }
        }
    });
    
    socket.on('executeManipulation', (data) => {
        const { manipulationId, companyName } = data;
        const company = gameState.companies.get(socket.id);
        
        if (company) {
            let message = '';
            
            switch (manipulationId) {
                case
