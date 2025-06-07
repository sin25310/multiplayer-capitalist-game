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

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 游戏状态
const gameState = {
    companies: new Map(),
    aiCompanies: [
        {
            id: 'ai_apple',
            name: '咬一口科技',
            value: 25800000,
            trend: 1,
            sector: '科技',
            companyType: 'tech',
            evilQuote: '隐私？那是什么？我们只是在"改善用户体验"'
        },
        {
            id: 'ai_microsoft',
            name: '巨硬垄断集团',
            value: 24200000,
            trend: 0,
            sector: '软件',
            companyType: 'tech',
            evilQuote: '拥抱、扩展、消灭 - 我们的永恒战略'
        },
        {
            id: 'ai_google',
            name: '狗狗搜索引擎',
            value: 23600000,
            trend: -1,
            sector: '互联网',
            companyType: 'tech',
            evilQuote: '"不作恶"？那个口号早就删了'
        },
        {
            id: 'ai_amazon',
            name: '压马逊剥削物流',
            value: 22800000,
            trend: 1,
            sector: '电商',
            companyType: 'retail',
            evilQuote: '员工的眼泪是最好的润滑剂'
        },
        {
            id: 'ai_tesla',
            name: '特死啦忽悠汽车',
            value: 18200000,
            trend: 1,
            sector: '汽车',
            companyType: 'manufacturing',
            evilQuote: '自动驾驶：让机器承担撞死人的责任'
        },
        {
            id: 'ai_goldman',
            name: '高盛吸血银行',
            value: 16600000,
            trend: 0,
            sector: '金融',
            companyType: 'finance',
            evilQuote: '经济危机？那是我们的发财机会！'
        }
    ],
    globalMarket: {
        workforce: { price: 15000, trend: 0, volume: 0, supply: 0, demand: 0 },
        materials: { price: 12000, trend: 1, volume: 0, supply: 0, demand: 0 },
        technology: { price: 35000, trend: -1, volume: 0, supply: 0, demand: 0 },
        energy: { price: 18000, trend: 0, volume: 0, supply: 0, demand: 0 },
        data: { price: 25000, trend: 1, volume: 0, supply: 0, demand: 0 },
        reputation: { price: 30000, trend: 0, volume: 0, supply: 0, demand: 0 },
        influence: { price: 75000, trend: 1, volume: 0, supply: 0, demand: 0 }
    },
    chatMessages: [],
    serverStartTime: Date.now()
};

console.log('🏢 黑心公司大亨服务器启动中...');

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 玩家连接处理
io.on('connection', (socket) => {
    console.log('🔗 新CEO连接:', socket.id);
    
    socket.on('joinGame', (data) => {
        try {
            const { companyName, playerName, companyType, gameData } = data;
            
            if (!companyName || !playerName) {
                socket.emit('error', { message: '公司名称和玩家名称不能为空' });
                return;
            }
            
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
            
            addChatMessage('系统', `${companyName} 进入了商业战场！又来一个黑心企业！`);
            console.log(`🏢 公司 ${companyName}(${companyType}) 加入游戏`);
        } catch (error) {
            console.error('joinGame error:', error);
            socket.emit('error', { message: '加入游戏失败' });
        }
    });
    
    socket.on('updateGameData', (gameData) => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company && gameData) {
                company.gameData = gameData;
                company.lastSeen = Date.now();
            }
        } catch (error) {
            console.error('updateGameData error:', error);
        }
    });
    
    socket.on('marketTrade', (data) => {
        try {
            const { action, resource, amount } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !gameState.globalMarket[resource]) {
                return;
            }
            
            const market = gameState.globalMarket[resource];
            const tradeAmount = Math.max(1, parseInt(amount) || 1);
            
            if (action === 'buy' && company.gameData.resources.money >= market.price * tradeAmount) {
                company.gameData.resources.money -= market.price * tradeAmount;
                company.gameData.resources[resource] = (company.gameData.resources[resource] || 0) + tradeAmount;
                
                // 更新市场供需
                market.demand += tradeAmount;
                market.volume += tradeAmount;
                
                // 动态价格调整
                market.price = Math.max(5000, market.price + Math.floor(tradeAmount * market.price * 0.01));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `购买了${tradeAmount}单位${resource}`,
                    resourceData: company.gameData.resources
                });
                
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💰 ${company.name} 购买了 ${tradeAmount} 个 ${resource}`);
            }
            else if (action === 'sell' && (company.gameData.resources[resource] || 0) >= tradeAmount) {
                const sellPrice = Math.floor(market.price * 0.95); // 卖价比买价低5%
                company.gameData.resources[resource] -= tradeAmount;
                company.gameData.resources.money += sellPrice * tradeAmount;
                
                // 更新市场供需
                market.supply += tradeAmount;
                market.volume += tradeAmount;
                
                // 动态价格调整
                market.price = Math.max(5000, market.price - Math.floor(tradeAmount * market.price * 0.005));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `卖出了${tradeAmount}单位${resource}，获得${sellPrice * tradeAmount}金币`,
                    resourceData: company.gameData.resources
                });
                
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💱 ${company.name} 卖出了 ${tradeAmount} 个 ${resource}`);
            }
        } catch (error) {
            console.error('marketTrade error:', error);
        }
    });
    
    socket.on('stockTrade', (data) => {
        try {
            const { action, companyId, shares } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const targetCompany = [...gameState.companies.values(), ...gameState.aiCompanies]
                .find(c => c.id === companyId);
            
            if (!targetCompany) return;
            
            const sharePrice = Math.floor(targetCompany.value / 1000000) || 1;
            const tradeFee = player.gameData.companyType === 'finance' ? sharePrice * 0.01 : sharePrice * 0.02;
            const totalCost = sharePrice + tradeFee;
            const tradeShares = Math.max(1, parseInt(shares) || 1);
            
            if (!player.gameData.stocks) {
                player.gameData.stocks = {};
            }
            
            if (action === 'buy' && player.gameData.resources.money >= totalCost * tradeShares) {
                player.gameData.resources.money -= totalCost * tradeShares;
                player.gameData.stocks[companyId] = (player.gameData.stocks[companyId] || 0) + tradeShares;
                
                socket.emit('stockTradeSuccess', {
                    action, companyId, shares: tradeShares,
                    message: `购买了${tradeShares}股${targetCompany.name}股票`,
                    playerData: {
                        money: player.gameData.resources.money,
                        stocks: player.gameData.stocks
                    }
                });
                
                console.log(`📈 ${player.name} 购买了 ${tradeShares} 股 ${targetCompany.name}`);
            }
            else if (action === 'sell' && (player.gameData.stocks[companyId] || 0) >= tradeShares) {
                const sellPrice = sharePrice - tradeFee;
                player.gameData.stocks[companyId] -= tradeShares;
                player.gameData.resources.money += sellPrice * tradeShares;
                
                if (player.gameData.stocks[companyId] <= 0) {
                    delete player.gameData.stocks[companyId];
                }
                
                socket.emit('stockTradeSuccess', {
                    action, companyId, shares: tradeShares,
                    message: `卖出了${tradeShares}股${targetCompany.name}股票`,
                    playerData: {
                        money: player.gameData.resources.money,
                        stocks: player.gameData.stocks
                    }
                });
                
                console.log(`📉 ${player.name} 卖出了 ${tradeShares} 股 ${targetCompany.name}`);
            }
        } catch (error) {
            console.error('stockTrade error:', error);
        }
    });
    
    socket.on('chatMessage', (message) => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company && message && typeof message === 'string') {
                const filteredMessage = message.trim().substring(0, 200);
                if (filteredMessage.length > 0) {
                    addChatMessage(company.name, filteredMessage);
                }
            }
        } catch (error) {
            console.error('chatMessage error:', error);
        }
    });
    
    socket.on('disconnect', () => {
        try {
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
        } catch (error) {
            console.error('disconnect error:', error);
        }
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

function createNewCompany(companyType = 'tech') {
    try {
        const baseResources = {
            money: 1000000, 
            workforce: 20, 
            materials: 100, 
            technology: 50,
            energy: 80, 
            data: 30, 
            reputation: 100, 
            influence: 10
        };
        
        // 根据公司类型应用初始加成
        const typeBonus = {
            tech: { technology: 30, data: 20 },
            manufacturing: { materials: 80, energy: 50 },
            finance: { money: 500000, influence: 20 },
            retail: { reputation: 80, workforce: 30 }
        };
        
        const bonuses = typeBonus[companyType] || {};
        Object.keys(bonuses).forEach(resource => {
            if (baseResources[resource] !== undefined) {
                baseResources[resource] += bonuses[resource];
            }
        });
        
        return {
            resources: baseResources,
            departments: {
                hr: { name: 'HR部门', count: 1, cost: { money: 50000 } },
                manufacturing: { name: '生产部', count: 0, cost: { money: 80000, workforce: 5 } },
                rd: { name: '研发部', count: 0, cost: { money: 120000, workforce: 8 } },
                marketing: { name: '营销部', count: 0, cost: { money: 100000, workforce: 6 } },
                finance: { name: '金融部', count: 0, cost: { money: 150000, workforce: 10 } }
            },
            stocks: {},
            companyType: companyType,
            marketValue: 1000000,
            lastUpdate: Date.now()
        };
    } catch (error) {
        console.error('createNewCompany error:', error);
        return null;
    }
}

function getLeaderboard() {
    try {
        const companies = Array.from(gameState.companies.values())
            .filter(company => company && company.gameData)
            .map(company => {
                const value = calculateCompanyValue(company.gameData);
                return {
                    id: company.id,
                    name: company.name || '未知公司',
                    isPlayer: true,
                    value: value,
                    trend: Math.random() > 0.5 ? 1 : -1,
                    online: company.online,
                    companyType: company.companyType || 'tech'
                };
            });
        
        // 添加AI公司
        const allCompanies = [...companies, ...gameState.aiCompanies.map(ai => ({
            ...ai,
            isPlayer: false,
            online: false
        }))];
        
        return allCompanies.sort((a, b) => (b.value || 0) - (a.value || 0));
    } catch (error) {
        console.error('getLeaderboard error:', error);
        return [];
    }
}

function calculateCompanyValue(gameData) {
    try {
        if (!gameData || !gameData.resources) {
            return 0;
        }
        
        let value = gameData.resources.money || 0;
        
        // 资源价值
        Object.keys(gameData.resources).forEach(resource => {
            if (resource !== 'money' && gameState.globalMarket[resource]) {
                value += (gameData.resources[resource] || 0) * gameState.globalMarket[resource].price;
            }
        });
        
        // 部门价值
        if (gameData.departments) {
            Object.keys(gameData.departments).forEach(key => {
                const dept = gameData.departments[key];
                if (dept && dept.count) {
                    value += dept.count * 100000;
                }
            });
        }
        
        // 股票价值
        if (gameData.stocks) {
            Object.keys(gameData.stocks).forEach(companyId => {
                const shares = gameData.stocks[companyId];
                const company = [...gameState.companies.values(), ...gameState.aiCompanies]
                    .find(c => c.id === companyId);
                if (company && shares > 0) {
                    const sharePrice = Math.floor(company.value / 1000000) || 1;
                    value += shares * sharePrice;
                }
            });
        }
        
        return Math.max(0, value);
    } catch (error) {
        console.error('calculateCompanyValue error:', error);
        return 0;
    }
}

function addChatMessage(playerName, message) {
    try {
        if (!playerName || !message) return;
        
        const chatMessage = {
            player: String(playerName),
            message: String(message),
            timestamp: Date.now()
        };
        
        gameState.chatMessages.push(chatMessage);
        
        if (gameState.chatMessages.length > 200) {
            gameState.chatMessages.shift();
        }
        
        io.emit('chatMessage', chatMessage);
    } catch (error) {
        console.error('addChatMessage error:', error);
    }
}

function updateMarketSupplyDemand() {
    try {
        // 重置供需统计
        Object.keys(gameState.globalMarket).forEach(resource => {
            gameState.globalMarket[resource].supply = 0;
            gameState.globalMarket[resource].demand = 0;
        });
        
        // 统计所有玩家的供需
        gameState.companies.forEach(company => {
            if (company.gameData && company.gameData.departments) {
                Object.keys(company.gameData.departments).forEach(deptKey => {
                    const dept = company.gameData.departments[deptKey];
                    if (dept.count > 0) {
                        // 这里可以添加基于部门类型的供需计算
                        // 简化版本：随机波动
                        Object.keys(gameState.globalMarket).forEach(resource => {
                            gameState.globalMarket[resource].supply += Math.random() * 10;
                            gameState.globalMarket[resource].demand += Math.random() * 8;
                        });
                    }
                });
            }
        });
    } catch (error) {
        console.error('updateMarketSupplyDemand error:', error);
    }
}

// 定期更新市场价格
setInterval(() => {
    try {
        updateMarketSupplyDemand();
        
        Object.keys(gameState.globalMarket).forEach(resource => {
            const market = gameState.globalMarket[resource];
            if (market) {
                // 基于供需的价格调整
                const supplyDemandRatio = (market.demand + 1) / (market.supply + 1);
                const supplyDemandAdjustment = (supplyDemandRatio - 1) * 0.1;
                
                // 随机波动
                const randomChange = (Math.random() - 0.5) * 0.05;
                
                const totalChange = supplyDemandAdjustment + randomChange;
                market.price = Math.max(5000, Math.floor(market.price * (1 + totalChange)));
                market.trend = totalChange > 0.02 ? 1 : totalChange < -0.02 ? -1 : 0;
                
                // 重置交易量
                market.volume = Math.floor((market.volume || 0) * 0.9);
            }
        });
        
        // 更新AI公司价值
        gameState.aiCompanies.forEach(company => {
            if (company) {
                const change = (Math.random() - 0.5) * 0.03; // 降低波动
                company.value = Math.max(5000000, Math.floor((company.value || 5000000) * (1 + change)));
                company.trend = change > 0.01 ? 1 : change < -0.01 ? -1 : 0;
            }
        });
        
        io.emit('marketUpdate', gameState.globalMarket);
        console.log('📈 市场价格和AI公司价值已更新');
    } catch (error) {
        console.error('Market update error:', error);
    }
}, 20000); // 每20秒更新一次

// 定期更新排行榜
setInterval(() => {
    try {
        io.emit('leaderboardUpdate', getLeaderboard());
    } catch (error) {
        console.error('Leaderboard update error:', error);
    }
}, 10000); // 每10秒更新一次

// 定期发送AI公司的"邪恶言论"
setInterval(() => {
    try {
        if (Math.random() < 0.3) {
            const aiCompanies = gameState.aiCompanies.filter(c => c && c.name);
            if (aiCompanies.length > 0) {
                const aiCompany = aiCompanies[Math.floor(Math.random() * aiCompanies.length)];
                const evilQuotes = [
                    '又到了季度末，该"优化"人员结构了',
                    '用户数据？这是我们的核心资产！',
                    '垄断不是目标，是结果',
                    '什么？员工要涨薪？先让他们证明自己的价值',
                    '市场调节？我们就是市场！',
                    '慈善？那是给股东看的表演',
                    '创新的目的就是让竞争对手破产',
                    '法律？我们有最好的律师团队'
                ];
                
                const quote = aiCompany.evilQuote || evilQuotes[Math.floor(Math.random() * evilQuotes.length)];
                addChatMessage(aiCompany.name, quote);
            }
        }
    } catch (error) {
        console.error('AI quote error:', error);
    }
}, 30000); // 每30秒检查一次

const PORT = process.env.PORT || 3000;

server.listen(PORT, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    } else {
        console.log(`🚀 黑心公司大亨服务器运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
        console.log(`💼 等待黑心CEO们的加入...`);
    }
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});
