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
            name: '苹果果业集团',
            value: 2800000,
            trend: 1,
            sector: '科技',
            evilQuote: '创新就是把旧技术包装成新概念卖高价'
        },
        {
            name: '微软垄断有限公司',
            value: 2600000,
            trend: 0,
            sector: '软件',
            evilQuote: '免费只是为了让你上瘾，然后一次性收割'
        },
        {
            name: '谷歌数据挖掘厂',
            value: 2400000,
            trend: -1,
            sector: '互联网',
            evilQuote: '你的隐私就是我们的商业机密'
        },
        {
            name: '亚马逊剥削物流',
            value: 2200000,
            trend: 1,
            sector: '电商',
            evilQuote: '员工的眼泪是最好的润滑剂'
        },
        {
            name: '脸书洗脑科技',
            value: 2000000,
            trend: -1,
            sector: '社交',
            evilQuote: '制造焦虑比解决问题更赚钱'
        },
        {
            name: '特斯拉忽悠汽车',
            value: 1800000,
            trend: 1,
            sector: '汽车',
            evilQuote: '预售就是用客户的钱研发产品'
        },
        {
            name: '奈飞内容工厂',
            value: 1600000,
            trend: 0,
            sector: '娱乐',
            evilQuote: '制造上瘾内容，收割时间和金钱'
        },
        {
            name: '字节跳动洗脑机',
            value: 1400000,
            trend: 1,
            sector: '短视频',
            evilQuote: '算法知道你比你自己更了解你'
        }
    ],
    globalMarket: {
        workforce: { price: 50000, trend: 0, volume: 0 },
        materials: { price: 30000, trend: 1, volume: 0 },
        technology: { price: 200000, trend: -1, volume: 0 },
        energy: { price: 80000, trend: 0, volume: 0 },
        data: { price: 120000, trend: 1, volume: 0 },
        reputation: { price: 100000, trend: 0, volume: 0 },
        influence: { price: 500000, trend: 1, volume: 0 }
    },
    chatMessages: [],
    serverStartTime: Date.now()
};

console.log('🏢 黑心公司大亨服务器启动中...');

// 玩家连接处理
io.on('connection', (socket) => {
    console.log('🔗 新CEO连接:', socket.id);
    
    socket.on('joinGame', (data) => {
        const { companyName, playerName, gameData } = data;
        
        const companyData = {
            id: socket.id,
            name: companyName,
            playerName: playerName,
            gameData: gameData || createNewCompany(),
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
        
        addChatMessage('系统', `${companyName} 进入了商业战场！准备开始新一轮的剥削！`);
        console.log(`🏢 公司 ${companyName} 加入游戏`);
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
                market.price = Math.max(10000, market.price + Math.floor(amount * market.price * 0.01));
                
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
                market.price = Math.max(10000, market.price - Math.floor(amount * market.price * 0.01));
                
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
                case 'spread_rumors':
                    message = `${companyName} 雇佣水军散布谣言，竞争对手声誉受损！`;
                    // 随机降低其他公司声誉
                    gameState.companies.forEach((otherCompany, id) => {
                        if (id !== socket.id) {
                            otherCompany.gameData.resources.reputation = Math.max(0, 
                                otherCompany.gameData.resources.reputation - Math.random() * 20);
                        }
                    });
                    break;
                    
                case 'market_manipulation':
                    message = `${companyName} 进行内幕交易，股价暴涨！`;
                    company.gameData.resources.money += 200000;
                    break;
                    
                case 'monopoly_attempt':
                    message = `${companyName} 发起恶意收购，吞并了小公司！`;
                    company.gameData.resources.influence += 20;
                    company.gameData.resources.money += 300000;
                    break;
                    
                case 'regulatory_capture':
                    message = `${companyName} 成功收买监管机构，获得政策倾斜！`;
                    company.gameData.resources.influence += 50;
                    // 影响市场价格
                    Object.keys(gameState.globalMarket).forEach(resource => {
                        gameState.globalMarket[resource].price *= (0.9 + Math.random() * 0.2);
                    });
                    break;
            }
            
            socket.emit('manipulationSuccess', { message });
            addChatMessage('市场快讯', message);
            console.log(`🎭 ${companyName} 执行了 ${manipulationId}`);
        }
    });
    
    socket.on('chatMessage', (message) => {
        const company = gameState.companies.get(socket.id);
        if (company && message.trim()) {
            // 过滤敏感词（简化版）
            const filteredMessage = message.trim().substring(0, 200);
            addChatMessage(company.name, filteredMessage);
            console.log(`💬 ${company.name}: ${filteredMessage}`);
        }
    });
    
    socket.on('disconnect', () => {
        const company = gameState.companies.get(socket.id);
        if (company) {
            company.online = false;
            
            socket.broadcast.emit('companyLeft', {
                id: socket.id,
                name: company.name
            });
            
            addChatMessage('系统', `${company.name} 退出了商业战场`);
            console.log(`👋 公司 ${company.name} 断开连接`);
            
            // 24小时后删除公司数据
            setTimeout(() => {
                gameState.companies.delete(socket.id);
            }, 24 * 60 * 60 * 1000);
        }
    });
});

function createNewCompany() {
    return {
        resources: {
            money: 100000, workforce: 0, materials: 0, technology: 0,
            energy: 0, data: 0, reputation: 50, influence: 0
        },
        departments: {
            hr: { name: 'HR部门', count: 0, cost: { money: 50000 } },
            manufacturing: { name: '生产部', count: 0, cost: { money: 80000, workforce: 5 } },
            rd: { name: '研发部', count: 0, cost: { money: 150000, workforce: 10 } },
            marketing: { name: '营销部', count: 0, cost: { money: 120000, workforce: 8 } },
            finance: { name: '金融部', count: 0, cost: { money: 200000, workforce: 15 } },
            legal: { name: '法务部', count: 0, cost: { money: 300000, workforce: 12 } },
            lobbying: { name: '公关部', count: 0, cost: { money: 500000, workforce: 20, reputation: 100 } }
        },
        marketValue: 100000,
        lastUpdate: Date.now()
    };
}

function getLeaderboard() {
    const companies = Array.from(gameState.companies.values()).map(company => {
        const value = calculateCompanyValue(company.gameData);
        return {
            id: company.id,
            name: company.name,
            isPlayer: true,
            value: value,
            trend: Math.random() > 0.5 ? 1 : -1,
            online: company.online
        };
    });
    
    // 添加AI公司
    const allCompanies = [...companies, ...gameState.aiCompanies.map(ai => ({
        ...ai,
        isPlayer: false,
        online: false
    }))];
    
    return allCompanies.sort((a, b) => b.value - a.value);
}

function calculateCompanyValue(gameData) {
    let value = gameData.resources.money;
    
    // 资源价值
    Object.keys(gameData.resources).forEach(resource => {
        if (resource !== 'money' && gameState.globalMarket[resource]) {
            value += gameData.resources[resource] * gameState.globalMarket[resource].price;
        }
    });
    
    // 部门价值
    Object.keys(gameData.departments).forEach(key => {
        const dept = gameData.departments[key];
        value += dept.count * 100000;
    });
    
    return value;
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
        
        // 随机价格波动
        const volatility = 0.1;
        const change = (Math.random() - 0.5) * volatility;
        
        market.price = Math.max(10000, Math.floor(market.price * (1 + change)));
        market.trend = change > 0.05 ? 1 : change < -0.05 ? -1 : 0;
        market.volume = Math.floor(market.volume * 0.95); // 交易量衰减
    });
    
    // 更新AI公司价值
    gameState.aiCompanies.forEach(company => {
        const change = (Math.random() - 0.5) * 0.1;
        company.value = Math.max(500000, Math.floor(company.value * (1 + change)));
        company.trend = change > 0.03 ? 1 : change < -0.03 ? -1 : 0;
    });
    
    io.emit('marketUpdate', gameState.globalMarket);
    console.log('📈 市场价格和AI公司价值已更新');
}, 45000); // 每45秒更新一次

// 定期更新排行榜
setInterval(() => {
    io.emit('leaderboardUpdate', getLeaderboard());
}, 20000); // 每20秒更新一次

// 定期发送AI公司的"邪恶言论"
setInterval(() => {
    if (Math.random() < 0.3) { // 30%概率
        const aiCompany = gameState.aiCompanies[Math.floor(Math.random() * gameState.aiCompanies.length)];
        const evilQuotes = [
            '又到了季度末，该想办法降低员工成本了...',
            '消费者就是韭菜，一茬接一茬地割',
            '环保？那是什么？能赚钱吗？',
            '垄断是商业的最高境界',
            '数据就是新时代的石油，挖得越多赚得越多',
            '创新就是把简单的东西搞复杂，然后卖高价',
            '慈善只是为了避税和洗白形象',
            '员工996是福报，007是梦想！'
        ];
        
        const quote = evilQuotes[Math.floor(Math.random() * evilQuotes.length)];
        addChatMessage(aiCompany.name, quote);
    }
}, 60000); // 每分钟检查一次

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 黑心公司大亨服务器运行在端口 ${PORT}`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`💼 等待黑心CEO们的加入...`);
});
