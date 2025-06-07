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

// 健康检查路由
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
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
            
            const companyTypeNames = {
                tech: '科技', manufacturing: '制造', finance: '金融',
                retail: '零售', entertainment: '娱乐', pharma: '制药'
            };
            
            addChatMessage('系统', `${companyName}(${companyTypeNames[companyType] || '未知'})进入了商业战场！`);
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
                market.volume += tradeAmount;
                
                market.price = Math.max(5000, market.price + Math.floor(tradeAmount * market.price * 0.02));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `购买了${tradeAmount}单位${resource}` 
                });
                io.emit('marketUpdate', gameState.globalMarket);
            }
            else if (action === 'sell' && (company.gameData.resources[resource] || 0) >= tradeAmount) {
                company.gameData.resources[resource] -= tradeAmount;
                company.gameData.resources.money += market.price * tradeAmount;
                market.volume += tradeAmount;
                
                market.price = Math.max(5000, market.price - Math.floor(tradeAmount * market.price * 0.015));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `卖出了${tradeAmount}单位${resource}` 
                });
                io.emit('marketUpdate', gameState.globalMarket);
            }
        } catch (error) {
            console.error('marketTrade error:', error);
        }
    });
    
    socket.on('executeManipulation', (data) => {
        try {
            const { manipulationId, companyName } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company) return;
            
            let message = '';
            
            switch (manipulationId) {
                case 'spread_rumors':
                    message = `${companyName} 雇佣水军散布谣言，多家竞争对手声誉受损！`;
                    gameState.companies.forEach((otherCompany, id) => {
                        if (id !== socket.id && otherCompany.gameData.resources) {
                            otherCompany.gameData.resources.reputation = Math.max(0, 
                                (otherCompany.gameData.resources.reputation || 0) - Math.random() * 15);
                        }
                    });
                    break;
                    
                case 'market_manipulation':
                    message = `${companyName} 进行内幕交易，股价暴涨！`;
                    company.gameData.resources.money += 150000;
                    company.gameData.resources.reputation = Math.max(0, (company.gameData.resources.reputation || 0) - 5);
                    break;
                    
                case 'regulatory_capture':
                    message = `${companyName} 成功收买监管机构，获得政策倾斜！`;
                    company.gameData.resources.influence = (company.gameData.resources.influence || 0) + 30;
                    break;
                    
                case 'hostile_takeover':
                    message = `${companyName} 发起恶意收购，强行吞并了一家竞争企业！`;
                    company.gameData.resources.influence = (company.gameData.resources.influence || 0) + 40;
                    company.gameData.resources.money += 500000;
                    company.gameData.resources.reputation = Math.max(0, (company.gameData.resources.reputation || 0) - 20);
                    break;
                    
                default:
                    message = `${companyName} 执行了未知的邪恶计划`;
            }
            
            socket.emit('manipulationSuccess', { message });
            addChatMessage('市场快讯', message);
        } catch (error) {
            console.error('executeManipulation error:', error);
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
            money: 500000, 
            workforce: 10, 
            materials: 50, 
            technology: 20,
            energy: 30, 
            data: 15, 
            reputation: 100, 
            influence: 5
        };
        
        // 根据公司类型应用初始加成
        const typeBonus = {
            tech: { technology: 10, data: 10 },
            manufacturing: { materials: 30, energy: 20 },
            finance: { money: 200000, influence: 10 },
            retail: { reputation: 50, workforce: 15 },
            entertainment: { data: 20, reputation: 30 },
            pharma: { technology: 15, influence: 8 }
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
                hr: { name: 'HR部门', count: 0, cost: { money: 30000 } },
                manufacturing: { name: '生产部', count: 0, cost: { money: 50000, workforce: 3 } },
                rd: { name: '研发部', count: 0, cost: { money: 80000, workforce: 5 } },
                marketing: { name: '营销部', count: 0, cost: { money: 60000, workforce: 4 } },
                finance: { name: '金融部', count: 0, cost: { money: 100000, workforce: 6 } },
                legal: { name: '法务部', count: 0, cost: { money: 120000, workforce: 5 } },
                lobbying: { name: '公关部', count: 0, cost: { money: 200000, workforce: 8, reputation: 50 } }
            },
            talents: {
                basic_exploitation: { unlocked: false },
                advanced_manipulation: { unlocked: false },
                monopoly_tactics: { unlocked: false },
                global_corruption: { unlocked: false }
            },
            companyType: companyType,
            marketValue: 500000,
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
                    value += dept.count * 50000;
                }
            });
        }
        
        // 天赋价值
        if (gameData.talents) {
            Object.keys(gameData.talents).forEach(key => {
                if (gameData.talents[key] && gameData.talents[key].unlocked) {
                    value += 100000;
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

// 定期更新市场价格
setInterval(() => {
    try {
        Object.keys(gameState.globalMarket).forEach(resource => {
            const market = gameState.globalMarket[resource];
            if (market) {
                const volatility = 0.08;
                const change = (Math.random() - 0.5) * volatility;
                
                market.price = Math.max(5000, Math.floor(market.price * (1 + change)));
                market.trend = change > 0.03 ? 1 : change < -0.03 ? -1 : 0;
                market.volume = Math.floor((market.volume || 0) * 0.95);
            }
        });
        
        // 更新AI公司价值
        gameState.aiCompanies.forEach(company => {
            if (company) {
                const change = (Math.random() - 0.5) * 0.06;
                company.value = Math.max(1000000, Math.floor((company.value || 1000000) * (1 + change)));
                company.trend = change > 0.02 ? 1 : change < -0.02 ? -1 : 0;
            }
        });
        
        io.emit('marketUpdate', gameState.globalMarket);
    } catch (error) {
        console.error('Market update error:', error);
    }
}, 30000);

// 定期更新排行榜
setInterval(() => {
    try {
        io.emit('leaderboardUpdate', getLeaderboard());
    } catch (error) {
        console.error('Leaderboard update error:', error);
    }
}, 15000);

// 定期发送AI公司的"邪恶言论"
setInterval(() => {
    try {
        if (Math.random() < 0.4) {
            const aiCompanies = gameState.aiCompanies.filter(c => c && c.name);
            if (aiCompanies.length > 0) {
                const aiCompany = aiCompanies[Math.floor(Math.random() * aiCompanies.length)];
                const evilQuotes = [
                    '又到了季度末，该想办法"优化"员工成本了...',
                    '消费者就是韭菜，割了一茬还有一茬',
                    '环保？那是什么？对股价有帮助吗？',
                    '垄断是商业的最高境界，竞争是落后思维',
                    '数据就是新时代的石油，挖得越深赚得越多'
                ];
                
                const quote = aiCompany.evilQuote || evilQuotes[Math.floor(Math.random() * evilQuotes.length)];
                addChatMessage(aiCompany.name, quote);
            }
        }
    } catch (error) {
        console.error('AI quote error:', error);
    }
}, 45000);

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
